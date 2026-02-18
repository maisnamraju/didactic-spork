from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

logger = logging.getLogger("teraleads.ai_service")


class Settings(BaseModel):
    ai_mode: Literal["mock", "openrouter"] = "mock"
    ai_system_prompt: str = "You are a helpful dental assistant."
    ai_timeout_seconds: float = 20.0
    ai_mock_fail_key: str = "__fail_ai__"
    ai_mock_prefix: str = "Mock reply"
    openrouter_api_key: str | None = None
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_site_url: str | None = None
    openrouter_app_name: str = "TeraLeads AI Service"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        return Settings(
            ai_mode=os.getenv("AI_MODE", "mock"),
            ai_system_prompt=os.getenv(
                "AI_SYSTEM_PROMPT", "You are a helpful dental assistant."
            ),
            ai_timeout_seconds=float(os.getenv("AI_TIMEOUT_SECONDS", "20")),
            ai_mock_fail_key=os.getenv("AI_MOCK_FAIL_KEY", "__fail_ai__"),
            ai_mock_prefix=os.getenv("AI_MOCK_PREFIX", "Mock reply"),
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
            openrouter_model=os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
            openrouter_base_url=os.getenv(
                "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
            ),
            openrouter_site_url=os.getenv("OPENROUTER_SITE_URL"),
            openrouter_app_name=os.getenv(
                "OPENROUTER_APP_NAME", "TeraLeads AI Service"
            ),
        )
    except ValidationError as exc:
        logger.exception("Invalid AI service configuration: %s", exc)
        raise


class PatientContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: int | None = None
    patient_name: str | None = None
    medical_notes: str | None = None


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)
    patient_context: PatientContext | None = None

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("message cannot be empty")
        return trimmed


class GenerateResponse(BaseModel):
    message: str
    provider: str
    model: str


def build_user_prompt(payload: GenerateRequest) -> str:
    lines = [f"Patient question: {payload.message}"]

    if payload.patient_context:
        context = payload.patient_context
        lines.append("Patient context:")
        if context.patient_id is not None:
            lines.append(f"- Patient ID: {context.patient_id}")
        if context.patient_name:
            lines.append(f"- Name: {context.patient_name}")
        if context.medical_notes:
            lines.append(f"- Medical notes: {context.medical_notes}")

    lines.append("Provide a professional and helpful response.")
    return "\n".join(lines)


def build_mock_reply(payload: GenerateRequest, settings: Settings) -> str:
    if settings.ai_mock_fail_key in payload.message:
        raise RuntimeError("Mock AI provider failure requested")

    patient_name = (
        payload.patient_context.patient_name
        if payload.patient_context and payload.patient_context.patient_name
        else "patient"
    )
    return f"{settings.ai_mock_prefix} for {patient_name}: received \"{payload.message}\"."


def extract_openrouter_content(response_body: dict) -> str:
    choices = response_body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("OpenRouter response missing choices")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise RuntimeError("OpenRouter response choice has invalid format")

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("OpenRouter response missing message payload")

    content = message.get("content")

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        text_chunks: list[str] = []
        for chunk in content:
            if (
                isinstance(chunk, dict)
                and chunk.get("type") == "text"
                and isinstance(chunk.get("text"), str)
            ):
                text_chunks.append(chunk["text"])
        merged = "".join(text_chunks).strip()
        if merged:
            return merged

    raise RuntimeError("OpenRouter response did not contain textual content")


async def generate_with_openrouter(payload: GenerateRequest, settings: Settings) -> str:
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is required when AI_MODE=openrouter")

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "X-Title": settings.openrouter_app_name,
    }
    if settings.openrouter_site_url:
        headers["HTTP-Referer"] = settings.openrouter_site_url

    request_body = {
        "model": settings.openrouter_model,
        "messages": [
            {"role": "system", "content": settings.ai_system_prompt},
            {"role": "user", "content": build_user_prompt(payload)},
        ],
        "temperature": 0.2,
    }

    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"
    timeout = httpx.Timeout(settings.ai_timeout_seconds)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=request_body, headers=headers)
    except httpx.TimeoutException as exc:
        raise RuntimeError("OpenRouter request timed out") from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(f"OpenRouter request failed: {exc}") from exc

    if response.status_code >= 400:
        try:
            error_body = response.json()
        except ValueError:
            error_body = None

        if isinstance(error_body, dict):
            error = error_body.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                if isinstance(message, str) and message:
                    raise RuntimeError(f"OpenRouter error: {message}")

        raise RuntimeError(f"OpenRouter returned status {response.status_code}")

    try:
        parsed = response.json()
    except ValueError as exc:
        raise RuntimeError("OpenRouter response is not valid JSON") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError("OpenRouter response body has invalid format")

    return extract_openrouter_content(parsed)


app = FastAPI(title="TeraLeads AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "mode": settings.ai_mode}


@app.post("/generate", response_model=GenerateResponse)
async def generate(payload: GenerateRequest) -> GenerateResponse:
    settings = get_settings()

    try:
        if settings.ai_mode == "mock":
            reply = build_mock_reply(payload, settings)
            return GenerateResponse(message=reply, provider="mock", model="mock-v1")

        reply = await generate_with_openrouter(payload, settings)
        return GenerateResponse(
            message=reply,
            provider="openrouter",
            model=settings.openrouter_model,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "AI_SERVICE_CONFIG_ERROR", "message": str(exc)},
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "AI_PROVIDER_ERROR", "message": str(exc)},
        ) from exc
