from __future__ import annotations

import hashlib
from functools import lru_cache
import json
import re
import time
from typing import Any, Protocol

import httpx

from app.core.config import settings
from app.services.cache import cache


class LLMProviderError(Exception):
    def __init__(self, message: str, *, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


def _build_http_error(provider: str, exc: httpx.HTTPStatusError) -> LLMProviderError:
    status_code = exc.response.status_code
    details = exc.response.text.strip()
    if len(details) > 1000:
        details = f"{details[:1000]}..."
    retryable = status_code not in {400, 401, 403, 404}
    message = f"{provider} API error {status_code}: {details or str(exc)}"
    return LLMProviderError(message, retryable=retryable)


def _extract_retry_after_seconds(exc: httpx.HTTPStatusError) -> int | None:
    value = exc.response.headers.get("retry-after")
    if value:
        try:
            parsed = int(float(value.strip()))
            if parsed > 0:
                return parsed
        except Exception:  # noqa: BLE001
            pass

    body = exc.response.text or ""
    match = re.search(r"retry\s+after\s+(\d+(?:\.\d+)?)s", body, flags=re.IGNORECASE)
    if not match:
        match = re.search(r"retry\s+in\s+(\d+(?:\.\d+)?)s", body, flags=re.IGNORECASE)
    if not match:
        return None
    try:
        return max(1, int(float(match.group(1))))
    except Exception:  # noqa: BLE001
        return None


def _extract_openai_content(data: dict[str, Any]) -> str:
    choices = data.get("choices", [])
    if not choices:
        raise LLMProviderError(f"OpenAI returned no choices: {data}")

    message = choices[0].get("message", {})
    content = message.get("content")

    if isinstance(content, str):
        text = content.strip()
        if text:
            return text
        raise LLMProviderError("OpenAI returned empty response")

    if isinstance(content, list):
        text_parts: list[str] = []
        for chunk in content:
            if isinstance(chunk, dict):
                chunk_text = str(chunk.get("text", "")).strip()
                if chunk_text:
                    text_parts.append(chunk_text)
        joined = "\n".join(text_parts).strip()
        if joined:
            return joined
        raise LLMProviderError("OpenAI returned empty response")

    # Fallback for unexpected formats.
    fallback = str(content or "").strip()
    if fallback:
        return fallback
    raise LLMProviderError("OpenAI returned empty response")


def _is_openai_model_unavailable(exc: httpx.HTTPStatusError) -> bool:
    if exc.response.status_code not in {400, 404}:
        return False
    body = (exc.response.text or "").lower()
    return (
        "model_not_found" in body
        or "must be verified to use the model" in body
        or "does not exist" in body
        or "invalid model" in body
    )


_OPENAI_UNAVAILABLE_MODELS_BY_KEY: dict[str, set[str]] = {}
_OPENAI_PREFERRED_MODEL_BY_KEY: dict[str, str] = {}
_OPENAI_UNAVAILABLE_MODEL_TTL_SECONDS = 24 * 60 * 60


def _openai_unavailable_model_cache_key(api_key: str, model_name: str) -> str:
    digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:20]
    return f"llm:openai:unavailable:{digest}:{model_name}"


def _is_openai_model_cached_unavailable(api_key: str, model_name: str) -> bool:
    if not api_key or not model_name:
        return False
    cached = cache.get_json(_openai_unavailable_model_cache_key(api_key, model_name))
    return cached is not None


def _mark_openai_model_unavailable(api_key: str, model_name: str) -> None:
    if not api_key or not model_name:
        return
    bucket = _OPENAI_UNAVAILABLE_MODELS_BY_KEY.setdefault(api_key, set())
    bucket.add(model_name)
    cache.set_json(
        _openai_unavailable_model_cache_key(api_key, model_name),
        {"unavailable": True},
        ttl_seconds=_OPENAI_UNAVAILABLE_MODEL_TTL_SECONDS,
    )
    preferred = _OPENAI_PREFERRED_MODEL_BY_KEY.get(api_key)
    if preferred == model_name:
        _OPENAI_PREFERRED_MODEL_BY_KEY.pop(api_key, None)


def _mark_openai_model_preferred(api_key: str, model_name: str) -> None:
    if not api_key or not model_name:
        return
    _OPENAI_PREFERRED_MODEL_BY_KEY[api_key] = model_name
    cache.delete_many(_openai_unavailable_model_cache_key(api_key, model_name))


def _get_openai_model_candidates_for_key(api_key: str, model_candidates: list[str]) -> list[str]:
    unavailable = set(_OPENAI_UNAVAILABLE_MODELS_BY_KEY.get(api_key, set()))
    for model_name in model_candidates:
        if _is_openai_model_cached_unavailable(api_key, model_name):
            unavailable.add(model_name)
    filtered = [model for model in model_candidates if model not in unavailable]
    ordered = filtered or model_candidates

    preferred = _OPENAI_PREFERRED_MODEL_BY_KEY.get(api_key)
    if not preferred or preferred not in ordered:
        return ordered
    return [preferred, *[model for model in ordered if model != preferred]]


class LLMProvider(Protocol):
    def chat(
        self,
        *,
        messages: list[dict[str, str]],
        temperature: float,
        timeout_seconds: int,
        max_tokens: int | None = None,
        audience: str | None = None,
    ) -> str: ...


class OpenAIProvider:
    def chat(
        self,
        *,
        messages: list[dict[str, str]],
        temperature: float,
        timeout_seconds: int,
        max_tokens: int | None = None,
        audience: str | None = None,
    ) -> str:
        api_keys = settings.get_openai_api_keys(audience)
        if not api_keys:
            raise LLMProviderError("OpenAI API key is missing")

        endpoint = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
        model_candidates = settings.get_openai_model_candidates()
        base_payload: dict[str, Any] = {
            "messages": messages,
            "temperature": float(temperature),
            "response_format": {"type": "json_object"},
        }
        normalized_max_tokens: int | None = None
        if max_tokens is not None:
            normalized_max_tokens = max(64, int(max_tokens))
            base_payload["max_completion_tokens"] = normalized_max_tokens

        last_http_error: httpx.HTTPStatusError | None = None

        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                for key_idx, api_key in enumerate(api_keys):
                    key_model_candidates = _get_openai_model_candidates_for_key(api_key, model_candidates)
                    for model_name in key_model_candidates:
                        include_json_mode = True
                        token_field = "max_completion_tokens" if normalized_max_tokens is not None else None
                        waited = False
                        attempted_variants: set[tuple[bool, str | None]] = set()
                        move_to_next_model = False
                        move_to_next_key = False

                        while True:
                            variant_signature = (include_json_mode, token_field)
                            if variant_signature in attempted_variants:
                                break
                            attempted_variants.add(variant_signature)

                            payload = dict(base_payload)
                            payload["model"] = model_name
                            if not include_json_mode:
                                payload.pop("response_format", None)
                            if token_field is None:
                                payload.pop("max_completion_tokens", None)
                            elif token_field == "max_tokens":
                                payload.pop("max_completion_tokens", None)
                                payload["max_tokens"] = normalized_max_tokens

                            try:
                                response = client.post(
                                    endpoint,
                                    headers={
                                        "Authorization": f"Bearer {api_key}",
                                        "Content-Type": "application/json",
                                    },
                                    json=payload,
                                )
                                response.raise_for_status()
                                data = response.json()
                                _mark_openai_model_preferred(api_key, model_name)
                                return _extract_openai_content(data)
                            except httpx.HTTPStatusError as exc:
                                last_http_error = exc
                                status_code = exc.response.status_code
                                body = exc.response.text.lower()

                                if _is_openai_model_unavailable(exc):
                                    _mark_openai_model_unavailable(api_key, model_name)
                                    move_to_next_model = True
                                    break

                                if status_code == 400 and "response_format" in body and include_json_mode:
                                    include_json_mode = False
                                    continue

                                if (
                                    status_code == 400
                                    and token_field == "max_completion_tokens"
                                    and (
                                        "max_completion_tokens" in body
                                        or "max_tokens" in body
                                        or "max_output_tokens" in body
                                    )
                                ):
                                    token_field = "max_tokens"
                                    continue

                                # One controlled wait-retry on 429 for the current key.
                                if status_code == 429 and not waited:
                                    wait_seconds = _extract_retry_after_seconds(exc)
                                    if wait_seconds is None:
                                        wait_seconds = 8
                                    wait_seconds = max(1, min(wait_seconds, 20))
                                    time.sleep(wait_seconds)
                                    waited = True
                                    continue

                                if status_code in {401, 403, 429} and key_idx < len(api_keys) - 1:
                                    move_to_next_key = True
                                    break

                                raise
                            except json.JSONDecodeError as exc:
                                raise LLMProviderError(f"OpenAI returned invalid JSON: {exc}") from exc
                            except httpx.ReadTimeout as exc:
                                raise LLMProviderError("Превышено время ожидания ответа LLM.", retryable=False) from exc

                        if move_to_next_key:
                            break
                        if move_to_next_model:
                            continue

            if last_http_error is not None:
                raise last_http_error
            raise LLMProviderError("OpenAI request failed without response")
        except httpx.HTTPStatusError as exc:
            raise _build_http_error("OpenAI", exc) from exc
        except LLMProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise LLMProviderError(str(exc)) from exc


class DisabledProvider:
    def chat(
        self,
        *,
        messages: list[dict[str, str]],
        temperature: float,
        timeout_seconds: int,
        max_tokens: int | None = None,
        audience: str | None = None,
    ) -> str:
        raise LLMProviderError("LLM provider is disabled")


@lru_cache
def _get_llm_provider_cached(provider_name: str) -> LLMProvider:
    if provider_name == "openai":
        return OpenAIProvider()
    return DisabledProvider()


def _normalize_provider_name(provider_name: str | None = None, *, audience: str | None = None) -> str:
    if provider_name and provider_name.strip():
        normalized = provider_name.strip().lower()
    else:
        normalized_audience = str(audience or "").strip().lower()
        if normalized_audience == "teacher":
            normalized = (
                settings.teacher_ai_provider
                or settings.ai_provider
                or "openai"
            ).strip().lower()
        elif normalized_audience == "student":
            normalized = (
                settings.student_ai_provider
                or settings.ai_provider
                or "openai"
            ).strip().lower()
        else:
            normalized = (settings.ai_provider or "").strip().lower() or "openai"

    # Backward-compatible aliases from old providers.
    if normalized in {"deepseek", "gemini", "claude"}:
        return "openai"
    return normalized


def get_llm_provider(provider_name: str | None = None, *, audience: str | None = None) -> LLMProvider:
    normalized = _normalize_provider_name(provider_name, audience=audience)
    return _get_llm_provider_cached(normalized)


def is_llm_provider_configured(provider_name: str | None = None, *, audience: str | None = None) -> bool:
    normalized = _normalize_provider_name(provider_name, audience=audience)
    if normalized == "openai":
        return bool(settings.get_openai_api_key(audience))
    return False


def llm_chat(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    timeout_seconds: int,
    provider_name: str | None = None,
    max_tokens: int | None = None,
    audience: str | None = None,
) -> str:
    provider = get_llm_provider(provider_name, audience=audience)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return provider.chat(
        messages=messages,
        temperature=temperature,
        timeout_seconds=timeout_seconds,
        max_tokens=max_tokens,
        audience=audience,
    )
