"""Virtual Security Officer — Google Gemini client helpers for chat and remediation."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError, NotFound, ResourceExhausted, TooManyRequests

from app.config import settings

logger = logging.getLogger(__name__)

_MODEL_LIST_CACHE_TTL_SEC = 300.0
_model_list_cache: tuple[float, list[str]] | None = None


def _configure() -> None:
    genai.configure(api_key=settings.gemini_api_key)


def _strip_models_prefix(name: str) -> str:
    n = name.strip()
    if n.startswith("models/"):
        return n[7:]
    return n


def _discovered_generate_content_models() -> list[str]:
    """IDs your API key can call (avoids hardcoding preview names that 404 on v1beta)."""
    global _model_list_cache
    now = time.monotonic()
    if _model_list_cache is not None and (now - _model_list_cache[0]) < _MODEL_LIST_CACHE_TTL_SEC:
        return _model_list_cache[1]

    _configure()
    names: list[str] = []
    try:
        for m in genai.list_models():
            methods = getattr(m, "supported_generation_methods", None) or []
            if "generateContent" not in methods:
                continue
            short = _strip_models_prefix(m.name)
            if "embedding" in short.lower():
                continue
            names.append(short)
    except Exception as exc:
        logger.warning("Gemini list_models failed: %s", exc)
        _model_list_cache = (now, [])
        return []

    def sort_key(x: str) -> tuple[int, str]:
        xl = x.lower()
        pref = 0 if "flash" in xl else 1
        return (pref, x)

    names = sorted(set(names), key=sort_key)
    _model_list_cache = (now, names)
    return names


def _model_fallback_chain() -> list[str]:
    """User preference first, then any models the API reports as supporting generateContent."""
    primary = _strip_models_prefix(settings.gemini_model or "")
    discovered = _discovered_generate_content_models()
    out: list[str] = []
    seen: set[str] = set()
    max_models = 12

    if primary:
        seen.add(primary)
        out.append(primary)
    for m in discovered:
        if m not in seen:
            seen.add(m)
            out.append(m)
        if len(out) >= max_models:
            break

    # If list_models failed or empty, try stable public names (no dated preview IDs).
    if len(out) <= 1 and not discovered:
        for fb in (
            "gemini-2.0-flash",
            "gemini-2.0-flash-001",
            "gemini-1.5-flash-8b",
            "gemini-1.5-flash",
            "gemini-1.5-flash-002",
        ):
            if fb not in seen:
                seen.add(fb)
                out.append(fb)
    return out


def _is_model_not_found(exc: GoogleAPIError) -> bool:
    if isinstance(exc, NotFound):
        return True
    err_l = str(exc).lower()
    return "not found" in err_l or "does not exist" in err_l or ("invalid" in err_l and "model" in err_l)


def _to_gemini_history(messages: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Map user | assistant roles to Gemini chat history (user | model)."""
    out: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "assistant":
            role = "model"
        if role not in ("user", "model"):
            role = "user"
        out.append({"role": role, "parts": [content]})
    return out


def stream_chat(messages: list[dict[str, str]], system_instruction: str) -> Iterator[str]:
    """
    Stream assistant tokens. `messages` uses roles user | assistant (mapped to model).
    """
    if not messages:
        return

    _configure()
    gm = _to_gemini_history(messages)
    last_quota: BaseException | None = None
    last_error: BaseException | None = None

    for model_name in _model_fallback_chain():
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction,
            )
            if len(gm) == 1:
                response = model.generate_content(gm[0]["parts"][0], stream=True)
            else:
                history = gm[:-1]
                last_user = gm[-1]["parts"][0]
                chat = model.start_chat(history=history)
                response = chat.send_message(last_user, stream=True)

            for chunk in response:
                text = getattr(chunk, "text", None)
                if text:
                    yield text
            return
        except (ResourceExhausted, TooManyRequests) as exc:
            logger.warning("Gemini quota on %s: %s", model_name, exc)
            last_quota = exc
            last_error = exc
            continue
        except NotFound as exc:
            logger.warning("Gemini model not found %s: %s", model_name, exc)
            last_error = exc
            continue
        except GoogleAPIError as exc:
            last_error = exc
            if _is_model_not_found(exc):
                logger.warning("Gemini model error on %s: %s", model_name, exc)
                continue
            raise

    if last_quota is not None:
        raise last_quota
    if last_error is not None:
        raise last_error
    raise RuntimeError("Gemini: no model could be used for chat")


def generate_text(system_instruction: str, user_content: str) -> str:
    """Single-turn generation (e.g. remediation JSON). Tries models your key actually supports."""
    _configure()
    last_quota: BaseException | None = None
    last_error: BaseException | None = None

    for model_name in _model_fallback_chain():
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction,
            )
            response = model.generate_content(user_content)
            try:
                return (response.text or "").strip()
            except (ValueError, AttributeError):
                return ""
        except (ResourceExhausted, TooManyRequests) as exc:
            logger.warning("Gemini quota on %s: %s", model_name, exc)
            last_quota = exc
            last_error = exc
            continue
        except NotFound as exc:
            logger.warning("Gemini model not found %s: %s", model_name, exc)
            last_error = exc
            continue
        except GoogleAPIError as exc:
            last_error = exc
            if _is_model_not_found(exc):
                logger.warning("Gemini model error on %s: %s", model_name, exc)
                continue
            raise

    if last_quota is not None:
        raise last_quota
    if last_error is not None:
        raise last_error
    raise RuntimeError("Gemini: no model names configured")


def parse_json_loose(raw: str) -> dict[str, Any]:
    """Parse model output; strip markdown fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if len(lines) >= 2:
            text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[: text.rfind("```")].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}
