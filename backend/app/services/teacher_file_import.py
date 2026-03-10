from __future__ import annotations

import csv
import html
import io
import mimetypes
import re
import zipfile
from typing import Any
from xml.etree import ElementTree as ET

MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024
MAX_IMPORT_QUESTIONS = 120

_TAG_PATTERN = re.compile(r"(<\+?a>|<q>)", flags=re.IGNORECASE)
_TEXT_SPLIT_PATTERN = re.compile(r"\s+")


def parse_teacher_test_import_file(*, filename: str, content: bytes) -> list[dict[str, Any]]:
    if len(content) > MAX_IMPORT_SIZE_BYTES:
        raise ValueError("Размер файла превышает лимит 5MB.")

    lower_name = (filename or "").strip().lower()
    if lower_name.endswith(".docx"):
        questions = _parse_docx(content)
    elif lower_name.endswith(".csv"):
        questions = _parse_csv(content)
    elif lower_name.endswith(".doc"):
        raise ValueError("Формат .doc не поддерживается. Сохраните файл как .docx.")
    else:
        raise ValueError("Поддерживаются только файлы .docx и .csv.")

    if not questions:
        raise ValueError("Не удалось распознать вопросы. Проверьте шаблон файла.")
    return questions[:MAX_IMPORT_QUESTIONS]


def _parse_docx(content: bytes) -> list[dict[str, Any]]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        doc_xml = archive.read("word/document.xml")
        rels_xml = archive.read("word/_rels/document.xml.rels")
        image_map = _build_docx_image_map(archive=archive, rels_xml=rels_xml)

    root = ET.fromstring(doc_xml)
    ns = {
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    }

    questions: list[dict[str, Any]] = []
    current = _new_draft_question()
    saw_explicit_question = False

    def flush_current() -> None:
        nonlocal current
        normalized = _normalize_draft_question(current)
        if normalized is not None:
            questions.append(normalized)
        current = _new_draft_question()

    for paragraph in root.findall(".//w:p", ns):
        paragraph_text = _paragraph_text(paragraph=paragraph, ns=ns)
        paragraph_text = html.unescape(paragraph_text)
        embed_ids = [
            blip.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            for blip in paragraph.findall(".//a:blip", ns)
        ]
        embed_ids = [item for item in embed_ids if item]

        if embed_ids:
            for embed_id in embed_ids:
                image_data_url = image_map.get(embed_id)
                if image_data_url and not current["image_data_url"]:
                    current["image_data_url"] = image_data_url
                    break

        paragraph_text = paragraph_text.strip()
        if not paragraph_text:
            continue

        line_lower = paragraph_text.lower()
        starts_with_tag = (
            line_lower.startswith("<q>")
            or line_lower.startswith("<a>")
            or line_lower.startswith("<+a>")
        )

        if starts_with_tag:
            segments = _split_tagged_text(paragraph_text)
        else:
            # Ignore template/instruction paragraphs before the first explicit "<q>".
            if not saw_explicit_question and not current["prompt"] and not current["options"]:
                continue
            segments = [(None, paragraph_text)]

        for tag, text in segments:
            normalized_text = _normalize_whitespace(text)
            if not normalized_text:
                continue
            if tag == "q":
                if current["prompt"] or current["options"]:
                    flush_current()
                saw_explicit_question = True
                current["prompt"] = normalized_text
                continue

            if tag in {"a", "+a"}:
                if not saw_explicit_question and not current["prompt"]:
                    continue
                option_index = len(current["options"])
                current["options"].append(normalized_text)
                if tag == "+a":
                    current["correct_option_indexes"].append(option_index)
                continue

            # Plain text fallback (multi-line prompt/option continuation).
            lower_text = normalized_text.lower()
            if "можно вставить картинку" in lower_text:
                continue
            if not saw_explicit_question and not current["prompt"] and not current["options"]:
                continue
            if current["options"]:
                current["options"][-1] = _normalize_whitespace(f"{current['options'][-1]} {normalized_text}")
            elif current["prompt"]:
                current["prompt"] = _normalize_whitespace(f"{current['prompt']} {normalized_text}")
            else:
                current["prompt"] = normalized_text

    normalized = _normalize_draft_question(current)
    if normalized is not None:
        questions.append(normalized)
    return questions


def _parse_csv(content: bytes) -> list[dict[str, Any]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    questions: list[dict[str, Any]] = []

    for row in reader:
        if not isinstance(row, dict):
            continue
        prompt = _normalize_whitespace(str(row.get("prompt", "")))
        if not prompt:
            continue

        raw_type = str(row.get("answer_type", "")).strip().lower()
        answer_type = "free_text" if raw_type in {"free_text", "text", "short_text"} else "choice"
        options = _parse_csv_options(row)
        correct_index = _parse_csv_correct_index(row, len(options))
        sample_answer = _normalize_whitespace(
            str(row.get("sample_answer") or row.get("correct_answer") or row.get("answer") or "")
        )
        image_data_url = _normalize_whitespace(str(row.get("image_data_url") or ""))
        if image_data_url and not image_data_url.startswith("data:image/"):
            image_data_url = ""

        draft = {
            "prompt": prompt,
            "options": options,
            "correct_option_indexes": ([correct_index] if correct_index is not None else []),
            "sample_answer": sample_answer,
            "image_data_url": image_data_url or None,
            "forced_answer_type": answer_type,
        }
        normalized = _normalize_draft_question(draft)
        if normalized is None:
            continue
        if answer_type == "free_text":
            normalized["answer_type"] = "free_text"
            normalized["options"] = []
            normalized["correct_option_index"] = None
            normalized["sample_answer"] = sample_answer or normalized.get("sample_answer") or "Эталонный ответ"
        questions.append(normalized)

    return questions


def _parse_csv_options(row: dict[str, Any]) -> list[str]:
    options: list[str] = []
    for index in range(1, 9):
        value = _normalize_whitespace(str(row.get(f"option{index}", "")))
        if value:
            options.append(value)
    if options:
        return options

    inline = _normalize_whitespace(str(row.get("options", "")))
    if inline:
        parts = [item.strip() for item in re.split(r"[|;]", inline) if item.strip()]
        return parts
    return []


def _parse_csv_correct_index(row: dict[str, Any], options_len: int) -> int | None:
    raw_value = str(row.get("correct_option_index", "")).strip()
    if raw_value and raw_value.lstrip("-").isdigit():
        value = int(raw_value)
        if 0 <= value < options_len:
            return value

    raw_label = str(row.get("correct_option", "")).strip().upper()
    if raw_label and len(raw_label) == 1 and "A" <= raw_label <= "Z":
        value = ord(raw_label) - ord("A")
        if 0 <= value < options_len:
            return value
    return None


def _build_docx_image_map(*, archive: zipfile.ZipFile, rels_xml: bytes) -> dict[str, str]:
    rels_root = ET.fromstring(rels_xml)
    rel_ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    relation_targets: dict[str, str] = {}
    for rel in rels_root.findall(".//r:Relationship", rel_ns):
        rel_id = rel.attrib.get("Id")
        target = rel.attrib.get("Target")
        if rel_id and target:
            relation_targets[rel_id] = target

    output: dict[str, str] = {}
    for rel_id, target in relation_targets.items():
        normalized_target = target.lstrip("./")
        if not normalized_target.startswith("media/"):
            continue
        path = f"word/{normalized_target}"
        if path not in archive.namelist():
            continue
        image_bytes = archive.read(path)
        mime_type, _ = mimetypes.guess_type(path)
        if not mime_type or not mime_type.startswith("image/"):
            mime_type = "image/png"
        data_url = f"data:{mime_type};base64,{_to_base64(image_bytes)}"
        output[rel_id] = data_url
    return output


def _to_base64(raw: bytes) -> str:
    import base64

    return base64.b64encode(raw).decode("ascii")


def _paragraph_text(*, paragraph: ET.Element, ns: dict[str, str]) -> str:
    chunks = [node.text or "" for node in paragraph.findall(".//w:t", ns)]
    return "".join(chunks).strip()


def _split_tagged_text(text: str) -> list[tuple[str | None, str]]:
    parts = _TAG_PATTERN.split(text)
    output: list[tuple[str | None, str]] = []
    current_tag: str | None = None
    for part in parts:
        raw = part or ""
        tag = raw.strip().lower()
        if tag in {"<q>", "<a>", "<+a>"}:
            current_tag = tag.strip("<>")
            continue
        if raw.strip():
            output.append((current_tag, raw))
    if not output:
        output.append((None, text))
    return output


def _new_draft_question() -> dict[str, Any]:
    return {
        "prompt": "",
        "options": [],
        "correct_option_indexes": [],
        "sample_answer": "",
        "image_data_url": None,
    }


def _normalize_draft_question(payload: dict[str, Any]) -> dict[str, Any] | None:
    prompt = _normalize_whitespace(str(payload.get("prompt", "")))
    options = [_normalize_whitespace(str(item)) for item in (payload.get("options") or [])]
    options = [item for item in options if item]
    correct_option_indexes = [int(item) for item in (payload.get("correct_option_indexes") or []) if isinstance(item, int)]
    sample_answer = _normalize_whitespace(str(payload.get("sample_answer", "")))
    image_data_url = payload.get("image_data_url")
    if isinstance(image_data_url, str):
        image_data_url = image_data_url.strip() or None
    else:
        image_data_url = None

    if not prompt:
        return None

    unique_options: list[str] = []
    seen_options: set[str] = set()
    for option in options:
        key = option.lower()
        if key in seen_options:
            continue
        seen_options.add(key)
        unique_options.append(option)
    options = unique_options[:8]

    correct_index = correct_option_indexes[0] if correct_option_indexes else None
    if correct_index is not None and (correct_index < 0 or correct_index >= len(options)):
        correct_index = None

    answer_type = "choice"
    if len(options) < 2:
        answer_type = "free_text"
    if answer_type == "choice" and correct_index is None:
        correct_index = 0

    if answer_type == "free_text":
        if not sample_answer:
            if options:
                if correct_index is not None and 0 <= correct_index < len(options):
                    sample_answer = options[correct_index]
                else:
                    sample_answer = options[0]
            else:
                sample_answer = "Эталонный ответ"
        options = []
        correct_index = None

    return {
        "prompt": prompt,
        "answer_type": answer_type,
        "options": options,
        "correct_option_index": correct_index,
        "sample_answer": sample_answer if answer_type == "free_text" else None,
        "image_data_url": image_data_url,
    }


def _normalize_whitespace(value: str) -> str:
    return _TEXT_SPLIT_PATTERN.sub(" ", value).strip()
