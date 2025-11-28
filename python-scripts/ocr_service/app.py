import base64
import io
import os
import secrets
import structlog
from enum import Enum
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from openai import OpenAI
from pdf2image import convert_from_bytes
from PIL import Image
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, BaseSettings, Field, conlist, validator


structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()


class Settings(BaseSettings):
    openai_api_key: str = Field(..., env="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4o-mini", env="OPENAI_MODEL")
    max_upload_size: int = Field(8 * 1024 * 1024, env="MAX_UPLOAD_SIZE")


settings = Settings()
client = OpenAI(api_key=settings.openai_api_key)

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/heic",
    "image/heif",
    "application/pdf",
}

request_counter = Counter("ocr_requests_total", "Total OCR requests", ["endpoint", "status"])
request_latency = Histogram("ocr_request_latency_seconds", "Latency of OCR requests", ["endpoint"])


class DocumentType(str, Enum):
    offer = "offer"
    invoice = "invoice"
    receipt = "receipt"


class LineItem(BaseModel):
    description: str = Field(..., description="Item description")
    quantity: Optional[float] = Field(None, description="Quantity of the item")
    unit_price: Optional[float] = Field(None, description="Price per unit")
    total: Optional[float] = Field(None, description="Line total")


class Party(BaseModel):
    name: Optional[str]
    address: Optional[str]
    vat_number: Optional[str] = Field(None, description="Tax or VAT number")


class MonetaryAmount(BaseModel):
    currency: Optional[str] = Field(None, description="Currency code, e.g., EUR")
    amount: Optional[float] = Field(None, description="Numeric amount")


class DocumentPayload(BaseModel):
    document_type: DocumentType
    issue_date: Optional[str] = Field(None, description="ISO date of issue")
    due_date: Optional[str] = Field(None, description="ISO due date")
    total: Optional[MonetaryAmount]
    subtotal: Optional[MonetaryAmount]
    tax: Optional[MonetaryAmount]
    supplier: Optional[Party]
    customer: Optional[Party]
    items: Optional[conlist(LineItem, min_items=0)]
    notes: Optional[str]


class ExtractResponse(BaseModel):
    filename: str
    content_type: str
    payload: DocumentPayload

    @validator("filename")
    def validate_filename(cls, value: str) -> str:
        if not value:
            raise ValueError("Filename cannot be empty")
        return value


app = FastAPI(title="OCR Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    data = generate_latest()
    return PlainTextResponse(data, media_type=CONTENT_TYPE_LATEST)


def _secure_filename(original: Optional[str]) -> str:
    fallback = f"upload-{secrets.token_hex(4)}"
    if not original:
        return f"{fallback}.png"
    sanitized = Path(original).name
    sanitized = sanitized.replace(" ", "_")
    keepchars = [c for c in sanitized if c.isalnum() or c in {"-", "_", "."}]
    base = "".join(keepchars) or fallback
    stem = Path(base).stem or fallback
    suffix = Path(base).suffix or ".png"
    return f"{stem}-{secrets.token_hex(4)}{suffix}"


def _normalize_image_bytes(upload: UploadFile, raw_bytes: bytes) -> bytes:
    if upload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    if upload.content_type == "application/pdf":
        try:
            images = convert_from_bytes(raw_bytes, fmt="png")
        except Exception as exc:  # pragma: no cover - external dependency
            logger.error("pdf_conversion_failed", error=str(exc))
            raise HTTPException(status_code=400, detail="Unable to process PDF")
        if not images:
            raise HTTPException(status_code=400, detail="PDF contained no pages")
        output = io.BytesIO()
        images[0].convert("RGB").save(output, format="PNG")
        return output.getvalue()

    try:
        image = Image.open(io.BytesIO(raw_bytes))
    except Exception as exc:  # pragma: no cover
        logger.error("image_open_failed", error=str(exc))
        raise HTTPException(status_code=400, detail="Invalid image file")

    output = io.BytesIO()
    image.convert("RGB").save(output, format="PNG")
    return output.getvalue()


def _encode_image_for_openai(image_bytes: bytes) -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def _build_prompt() -> list:
    schema_description = (
        "Return a JSON object with keys: document_type (offer|invoice|receipt), "
        "issue_date, due_date, total {currency, amount}, subtotal {currency, amount}, "
        "tax {currency, amount}, supplier {name,address,vat_number}, customer {name,address,vat_number}, "
        "items (list of {description, quantity, unit_price, total}), and notes."
    )
    return [
        {
            "role": "system",
            "content": (
                "You are an expert in document understanding. "
                "Extract the requested fields from the provided document image. "
                "Always respond with valid JSON matching the described schema."
            ),
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": schema_description,
                }
            ],
        },
    ]


def _call_openai(image_data_url: str) -> dict:
    messages = _build_prompt()
    messages[-1]["content"].append({"type": "image_url", "image_url": {"url": image_data_url}})

    try:
        completion = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=messages,
        )
    except Exception as exc:  # pragma: no cover
        logger.error("openai_request_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="Upstream OCR provider failed")

    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise HTTPException(status_code=502, detail="Empty response from OCR provider")
    try:
        return DocumentPayload.model_validate_json(content).model_dump()
    except Exception:
        logger.warning("openai_response_validation_failed", response=content)
        raise HTTPException(status_code=502, detail="Failed to parse OCR response")


@app.post("/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...)):
    with request_latency.labels("extract").time():
        request_counter.labels("extract", "received").inc()
        raw_bytes = await file.read()
        if not raw_bytes:
            request_counter.labels("extract", "bad_request").inc()
            raise HTTPException(status_code=400, detail="Empty upload")
        if len(raw_bytes) > settings.max_upload_size:
            request_counter.labels("extract", "bad_request").inc()
            raise HTTPException(status_code=413, detail="File too large")

        normalized_bytes = _normalize_image_bytes(file, raw_bytes)
        image_data_url = _encode_image_for_openai(normalized_bytes)
        payload = _call_openai(image_data_url)

        filename = _secure_filename(file.filename)
        logger.info(
            "extraction_completed",
            filename=filename,
            content_type=file.content_type,
            size=len(raw_bytes),
            document_type=payload.get("document_type"),
        )
        request_counter.labels("extract", "success").inc()
        return JSONResponse(
            status_code=200,
            content=ExtractResponse(
                filename=filename,
                content_type=file.content_type or "application/octet-stream",
                payload=DocumentPayload(**payload),
            ).model_dump(),
        )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
