import json
from typing import Any
from uuid import UUID

from google.api_core.exceptions import (
    GoogleAPIError,
    NotFound,
    PermissionDenied,
    ResourceExhausted,
    TooManyRequests,
    Unauthenticated,
    InvalidArgument,
)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.agent import build_scan_context, build_system_prompt
from app.ai.gemini_client import generate_text, parse_json_loose, stream_chat
from app.config import settings
from app.database import get_db
from app.models import Domain, ScanResult, SecurityScore, User
from app.routers.auth import get_current_user
from app import vso_sqlite

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    domain_id: str
    message: str
    conversation_history: list[ChatMessage] = []


class RemediateRequest(BaseModel):
    domain_id: str
    finding_title: str
    finding_type: str


class ChatSaveBody(BaseModel):
    """Persist a conversation. `request` column stores JSON messages; `response` column stores last assistant text for listing."""

    messages: list[ChatMessage]
    domain_name: str | None = None


class ChatListItem(BaseModel):
    id: int
    domain_name: str | None
    preview: str
    created_at: str


def _gemini_configured() -> bool:
    return bool(settings.gemini_api_key and not settings.gemini_api_key.startswith("your-"))


def _gemini_upstream_error(exc: GoogleAPIError) -> HTTPException:
    """Map google-api-core errors to HTTP responses with actionable messages."""
    msg_lower = str(exc).lower()
    quota_hint = (
        "Gemini quota exceeded or no free-tier access for this model. "
        "The app tries several models automatically; you can also set GEMINI_MODEL in .env or enable billing. "
        "See https://ai.google.dev/gemini-api/docs/rate-limits"
    )
    if isinstance(exc, (ResourceExhausted, TooManyRequests)) or "quota" in msg_lower or "resource exhausted" in msg_lower:
        return HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=quota_hint)
    if isinstance(exc, NotFound):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gemini model not available: {settings.gemini_model}. Try another GEMINI_MODEL (e.g. gemini-2.0-flash or gemini-1.5-flash).",
        )
    if isinstance(exc, Unauthenticated):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini rejected the API key. Check GEMINI_API_KEY in .env.",
        )
    if isinstance(exc, PermissionDenied):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API access denied. Enable the Generative Language API for your Google Cloud project.",
        )
    if isinstance(exc, InvalidArgument):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Gemini invalid request: {exc}")
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Gemini API error: {exc}")


def _format_scan_for_context(rows: list[ScanResult]) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    for row in rows:
        raw = row.raw_data if isinstance(row.raw_data, dict) else {}
        payload.append(
            {
                "scan_type": row.scan_type.value if hasattr(row.scan_type, "value") else str(row.scan_type),
                "severity": row.severity.value if hasattr(row.severity, "value") else str(row.severity),
                "findings": raw.get("findings", []),
                "raw_data": raw,
            }
        )
    return payload


@router.post("/message")
async def chat_message(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _gemini_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Virtual Security Officer chat is not configured. Set GEMINI_API_KEY in the server environment.",
        )

    try:
        domain_uuid = UUID(payload.domain_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid domain_id.") from exc
    domain_row = await db.execute(select(Domain).where(Domain.id == domain_uuid, Domain.user_id == current_user.id))
    domain = domain_row.scalar_one_or_none()
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found.")

    scan_rows_result = await db.execute(
        select(ScanResult).where(ScanResult.domain_id == domain_uuid).order_by(ScanResult.created_at.desc())
    )
    scan_rows = scan_rows_result.scalars().all()

    score_row = await db.execute(
        select(SecurityScore).where(SecurityScore.domain_id == domain_uuid).order_by(SecurityScore.created_at.desc()).limit(1)
    )
    score = score_row.scalar_one_or_none()
    if score is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No security score available for this domain.")

    scan_context = build_scan_context(
        _format_scan_for_context(scan_rows),
        {
            "total_score": score.total_score,
            "grade": "N/A",
            "findings_summary": {
                "critical_count": sum(
                    1
                    for r in scan_rows
                    if (r.severity.value if hasattr(r.severity, "value") else str(r.severity)) == "critical"
                ),
                "warning_count": sum(
                    1
                    for r in scan_rows
                    if (r.severity.value if hasattr(r.severity, "value") else str(r.severity)) == "warning"
                ),
                "info_count": sum(
                    1 for r in scan_rows if (r.severity.value if hasattr(r.severity, "value") else str(r.severity)) == "info"
                ),
            },
        },
    )

    messages = [{"role": item.role, "content": item.content} for item in payload.conversation_history]
    messages.append({"role": "user", "content": payload.message})

    first_user_idx = next((i for i, m in enumerate(messages) if m.get("role") == "user"), None)
    if first_user_idx is None:
        messages.insert(0, {"role": "user", "content": f"{scan_context}\n\nUser request: {payload.message}"})
    else:
        messages[first_user_idx]["content"] = f"{scan_context}\n\n{messages[first_user_idx]['content']}"

    def _gemini_quota_message() -> str:
        return (
            "Gemini API quota exceeded or this model has no free-tier quota for your project. "
            "Try GEMINI_MODEL=gemini-1.5-flash (or gemini-2.0-flash) in .env, wait and retry, "
            "or check billing and limits at https://ai.google.dev/gemini-api/docs/rate-limits"
        )

    async def event_stream():
        try:
            for chunk in stream_chat(messages, build_system_prompt()):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
            msg = _gemini_quota_message() if isinstance(exc, ResourceExhausted) else f"Virtual Security Officer chat failed: {exc}"
            yield f"data: {json.dumps({'error': msg})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/remediate")
async def remediate_issue(
    payload: RemediateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _gemini_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Virtual Security Officer remediation is not configured. Set GEMINI_API_KEY in the server environment.",
        )

    try:
        domain_uuid = UUID(payload.domain_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid domain_id.") from exc
    domain_row = await db.execute(select(Domain).where(Domain.id == domain_uuid, Domain.user_id == current_user.id))
    if domain_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found.")

    prompt = (
        "You are Virtual Security Officer. Give me a step-by-step remediation guide\n"
        f"for this security issue: {payload.finding_title}. The audience is a small business\n"
        "owner with a web developer they can contact. Be specific, numbered, and\n"
        f"practical.\nIssue type: {payload.finding_type}"
    )

    user_block = (
        f"{prompt}\n\n"
        "Return JSON only with this schema:\n"
        '{"steps": ["..."], "estimated_time": "e.g. 1-2 hours", "difficulty": "easy|medium|hard"}'
    )

    try:
        text = generate_text(build_system_prompt(), user_block)
    except GoogleAPIError as exc:
        raise _gemini_upstream_error(exc) from exc

    parsed = parse_json_loose(text)
    if not parsed:
        steps = [line.strip() for line in text.splitlines() if line.strip()]
        parsed = {
            "steps": steps if steps else ["Review the issue details in Virtual Security Officer and contact your web developer."],
            "estimated_time": "Unknown",
            "difficulty": "medium",
        }

    return {
        "steps": parsed.get("steps", []),
        "estimated_time": parsed.get("estimated_time", "Unknown"),
        "difficulty": parsed.get("difficulty", "medium"),
    }


@router.get("/chats", response_model=list[ChatListItem])
async def list_saved_chats(current_user: User = Depends(get_current_user)):
    rows = await run_in_threadpool(vso_sqlite.list_chats, current_user.id)
    out: list[ChatListItem] = []
    for row in rows:
        msgs = vso_sqlite.parse_messages_from_request(row["request"])
        first_user = next((m["content"] for m in msgs if m.get("role") == "user"), "")
        preview = (first_user.strip() or "Saved conversation")[:240]
        if len(first_user) > 240:
            preview += "…"
        out.append(
            ChatListItem(
                id=row["id"],
                domain_name=row["domain_name"] or None,
                preview=preview,
                created_at=row["created_at"],
            )
        )
    return out


@router.post("/chats", status_code=status.HTTP_201_CREATED)
async def save_chat(payload: ChatSaveBody, current_user: User = Depends(get_current_user)):
    if not payload.messages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="messages must not be empty.")
    serializable = [{"role": m.role, "content": m.content} for m in payload.messages]
    request_json = json.dumps(serializable, ensure_ascii=False)
    assistant_texts = [m.content for m in payload.messages if m.role == "assistant" and m.content.strip()]
    response_preview = assistant_texts[-1] if assistant_texts else ""
    cid = await run_in_threadpool(
        vso_sqlite.insert_chat,
        current_user.id,
        payload.domain_name,
        request_json,
        response_preview,
    )
    return {"id": cid}


@router.delete("/chats/{chat_id}")
async def delete_saved_chat(chat_id: int, current_user: User = Depends(get_current_user)):
    deleted = await run_in_threadpool(vso_sqlite.delete_chat, current_user.id, chat_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/chats/{chat_id}/messages")
async def get_saved_chat_messages(chat_id: int, current_user: User = Depends(get_current_user)):
    row = await run_in_threadpool(vso_sqlite.get_chat_by_id, current_user.id, chat_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    msgs = vso_sqlite.parse_messages_from_request(row["request"])
    return {"messages": msgs}
