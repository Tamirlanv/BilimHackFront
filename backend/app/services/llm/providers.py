from __future__ import annotations

from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings


class LLMProviderError(Exception):
    pass


class LLMProvider(Protocol):
    def chat(self, *, messages: list[dict[str, str]], temperature: float, timeout_seconds: int) -> str: ...


class DeepSeekProvider:
    def chat(self, *, messages: list[dict[str, str]], temperature: float, timeout_seconds: int) -> str:
        if not settings.deepseek_api_key:
            raise LLMProviderError("DeepSeek API key is missing")

        endpoint = f"{settings.deepseek_base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": settings.deepseek_model,
            "messages": messages,
            "temperature": temperature,
        }
        headers = {
            "Authorization": f"Bearer {settings.deepseek_api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                response = client.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001
            raise LLMProviderError(str(exc)) from exc


class DisabledProvider:
    def chat(self, *, messages: list[dict[str, str]], temperature: float, timeout_seconds: int) -> str:
        raise LLMProviderError("LLM provider is disabled")


@lru_cache
def get_llm_provider() -> LLMProvider:
    provider_name = settings.ai_provider.strip().lower()
    if provider_name == "deepseek":
        return DeepSeekProvider()
    return DisabledProvider()


def llm_chat(*, system_prompt: str, user_prompt: str, temperature: float, timeout_seconds: int) -> str:
    provider = get_llm_provider()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return provider.chat(messages=messages, temperature=temperature, timeout_seconds=timeout_seconds)

