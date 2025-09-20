import io
import os
import re
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional

from flask import Flask, request, jsonify, g
from flask_cors import CORS
import pdfplumber
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image, ImageOps
import cv2
import numpy as np

# Conditional imports for optional features
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

# Flask & CORS
app = Flask(__name__)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins == "*":
    CORS(app, resources={r"/*": {"origins": "*"}})
else:
    origins_list = [origin.strip() for origin in allowed_origins.split(",")]
    CORS(app, resources={r"/*": {"origins": origins_list}})

# Configuration
DEFAULT_LANG = os.getenv("DEFAULT_TESSERACT_LANG", "swe+eng")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "25000000"))
API_KEY = os.getenv("API_KEY")
REQUIRE_API_KEY = os.getenv("REQUIRE_API_KEY", "false").lower() == "true"

# OCR tuning
OCR_MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "3"))
OCR_DPI = int(os.getenv("OCR_DPI", "300"))
OCR_OEM = int(os.getenv("OCR_OEM", "3"))
OCR_PSM = int(os.getenv("OCR_PSM", "6"))
OCR_MAX_MEGA_PIXELS = float(os.getenv("OCR_MAX_MEGA_PIXELS", "20.0"))

# Output
PREVIEW_LEN = int(os.getenv("PREVIEW_LEN", "500"))
INCLUDE_RAW_DEFAULT = os.getenv("INCLUDE_RAW_DEFAULT", "false").lower() == "true"

# Feature flags
PROMETHEUS_ENABLED = os.getenv("PROMETHEUS_ENABLED", "true").lower() == "true" and PROMETHEUS_AVAILABLE

# Image types
ALLOWED_IMG = {'image/jpeg', 'image/png', 'image/webp'}

# Prometheus metrics (if enabled)
if PROMETHEUS_ENABLED:
    REQUEST_COUNT = Counter('pdf_extract_requests_total', 'Total extraction requests', ['method', 'status'])
    REQUEST_DURATION = Histogram('pdf_extract_duration_seconds', 'Extraction request duration')

# Precompiled regex patterns
EMAIL_RE = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?\d{1,3}\s*)?(?:0\d|\d)\s*(?:[\d\s\-]{5,})")
ORGNR_RE = re.compile(r"\b\d{6,8}[-\s]?\d{4}\b|\b\d{10}\b")
DATE_CAND = re.compile(r"\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b|\b\d{1,2}[-./]\d{1,2}[-./]\d{4}\b")

DATE_FORMATS = [
    "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
    "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y",
]

# Field labels (Swedish to English mapping)
FIELD_LABELS: Dict[str, List[str]] = {
    "company_name": [r"företagsnamn", r"företag", r"company", r"\btill\b", r"\bkund\b"],
    "customer_number": [r"kundnummer", r"offertnummer", r"offert\s*nr", r"customer\s*number", r"\bk-\d+"],
    "contact_person": [r"kontaktperson", r"contact\s*person", r"\bkontakt\b"],
    "email": [r"e-?post", r"email", r"\bmail\b"],
    "phone": [r"telefon", r"\bphone\b", r"\btel\b", r"\bmobil\b"],
    "address": [r"adress", r"address", r"besöksadress"],
    "zip": [r"postnummer", r"postal\s*code", r"\bzip\b"],
    "city": [r"\bort\b", r"\bcity\b", r"\bstad\b"],
    "orgnr": [r"org\.?\s*nr", r"organisationsnummer", r"org\s*number"],
    "date": [r"datum", r"\bdate\b", r"created", r"skapad"],
    "position": [r"befattning", r"\bposition\b", r"\btitle\b", r"\broll\b"],
    "country": [r"\bland\b", r"\bcountry\b"],
}

# Precompile patterns
COMPILED_LABELS: Dict[str, List[re.Pattern]] = {
    key: [re.compile(pat, re.IGNORECASE) for pat in patterns]
    for key, patterns in FIELD_LABELS.items()
}

# Helper functions
def validate_api_key() -> bool:
    """Validate API key if required."""
    if not (REQUIRE_API_KEY or API_KEY):
        return True
    
    provided_key = request.headers.get("X-Api-Key")
    expected = API_KEY or ""
    return provided_key == expected

def parse_date(value: str) -> str:
    """Parse and normalize date to YYYY-MM-DD format."""
    v = value.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return v

def truncate_preview(text: str, n: int) -> str:
    """Truncate text for preview."""
    if len(text) <= n:
        return text
    return text[:n] + "..."

def normalize_phone(val: str) -> str:
    """Normalize phone number."""
    return re.sub(r"[^\d+\s-]", "", val).strip()

def normalize_zip(val: str) -> str:
    """Remove spaces from zip code."""
    return re.sub(r"\s", "", val)

def normalize_orgnr(val: str) -> str:
    """Normalize Swedish organization number."""
    m = ORGNR_RE.search(val)
    if not m:
        return val.strip()
    digits = re.sub(r"[^\d]", "", m.group(0))
    if len(digits) == 10:
        return f"{digits[:6]}-{digits[6:]}"
    return m.group(0).strip()

def limit_megapixels(img: Image.Image, max_mp: float) -> Image.Image:
    """Scale down image if it exceeds max megapixels."""
    w, h = img.size
    mp = (w * h) / 1_000_000.0
    if mp <= max_mp:
        return img
    scale = (max_mp / mp) ** 0.5
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)

def preprocess_image(img: Image.Image) -> Image.Image:
    """Light preprocessing for better OCR."""
    if img.mode != "L":
        img = img.convert("L")
    img = ImageOps.autocontrast(img)
    # Gentle binarization
    img = img.point(lambda x: 0 if x < 180 else 255, mode="1").convert("L")
    return img

def extract_text_pdfplumber(pdf_bytes: bytes) -> Tuple[str, int]:
    """Extract text using pdfplumber."""
    try:
        pages_read = 0
        text_parts: List[str] = []
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if text.strip():
                    text_parts.append(text)
                pages_read += 1
                
        return "\n".join(text_parts).strip(), pages_read
    except Exception as e:
        print(f"pdfplumber extraction failed: {e}")
        return "", 0

def extract_text_ocr(pdf_bytes: bytes, lang: str) -> Tuple[str, int]:
    """Extract text using Tesseract OCR."""
    try:
        images = convert_from_bytes(
            pdf_bytes,
            dpi=OCR_DPI,
            first_page=1,
            last_page=OCR_MAX_PAGES
        )
        
        text_parts: List[str] = []
        pages = 0
        config = f"--oem {OCR_OEM} --psm {OCR_PSM}"
        
        for img in images:
            pages += 1
            img = limit_megapixels(img, OCR_MAX_MEGA_PIXELS)
            img = preprocess_image(img)
            text = pytesseract.image_to_string(img, lang=lang, config=config)
            if text:
                text_parts.append(text)
                
        return "\n".join(text_parts).strip(), pages
    except Exception as e:
        print(f"OCR extraction failed: {e}")
        return "", 0

def extract_fields_from_text(text: str) -> Dict[str, str]:
    """Extract structured fields from text."""
    data = {
        "company_name": "",
        "customer_number": "",
        "contact_person": "",
        "email": "",
        "phone": "",
        "address": "",
        "zip": "",
        "city": "",
        "orgnr": "",
        "date": "",
        "position": "",
        "country": "",
    }

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    def same_line_value(line: str, patterns: List[re.Pattern]) -> Optional[str]:
        """Extract value from same line as label."""
        for rx in patterns:
            if rx.search(line.lower()):
                m = re.search(r"[:\-]\s*(.+)$", line)
                if m and m.group(1).strip():
                    return m.group(1).strip()
        return None

    def next_line_value(idx: int) -> Optional[str]:
        """Extract value from next non-empty line."""
        for j in range(idx + 1, min(idx + 4, len(lines))):
            if re.match(r"^[:\-\s]*$", lines[j]):
                continue
            return lines[j].strip()
        return None

    # Primary extraction pass
    for i, line in enumerate(lines):
        for key, patterns in COMPILED_LABELS.items():
            if data[key]:  # Skip if already found
                continue
                
            # Try same line first
            v = same_line_value(line, patterns)
            if v:
                data[key] = v
                continue
                
            # Try next line
            if any(rx.search(line.lower()) for rx in patterns):
                v2 = next_line_value(i)
                if v2:
                    data[key] = v2

    # Fallback regex searches
    if not data["email"]:
        m = EMAIL_RE.search(text)
        if m:
            data["email"] = m.group(0)

    if not data["phone"]:
        m = PHONE_RE.search(text)
        if m:
            data["phone"] = normalize_phone(m.group(0))

    if not data["orgnr"]:
        m = ORGNR_RE.search(text)
        if m:
            data["orgnr"] = normalize_orgnr(m.group(0))

    # Post-processing
    if data["customer_number"]:
        m = re.search(r"(?:[A-Z]-)?\d+", data["customer_number"], re.IGNORECASE)
        if m:
            data["customer_number"] = m.group(0).upper()

    if data["date"]:
        data["date"] = parse_date(data["date"])
    else:
        m = DATE_CAND.search(text)
        if m:
            data["date"] = parse_date(m.group(0))

    # Normalizations
    if data["zip"]:
        data["zip"] = normalize_zip(data["zip"])
    if data["phone"]:
        data["phone"] = normalize_phone(data["phone"])
    if data["orgnr"]:
        data["orgnr"] = normalize_orgnr(data["orgnr"])

    # Default country
    if not data["country"]:
        data["country"] = "Sverige"

    return data

# Receipt-specific functions
def ocr_image(img: Image.Image, lang: str, mode: str = "receipt") -> str:
    """
    OCR för kvitton: LSTM (oem=1), PSM 4 (single column of text).
    Mild preproc (autocontrast + binarisering), megapixel-guard återanvänds.
    """
    img = limit_megapixels(img, OCR_MAX_MEGA_PIXELS)
    # Preproc likt PDF-OCR men något snällare för kvittorader
    if img.mode != "L":
        img = img.convert("L")
    img = ImageOps.autocontrast(img)
    img = img.point(lambda x: 0 if x < 170 else 255, mode="1").convert("L")

    oem = 1  # LSTM only
    psm = 4  # Single column of text (kvitto)
    config = f"--oem {oem} --psm {psm}"

    return pytesseract.image_to_string(img, lang=lang, config=config)

def extract_receipt_fields(text: str) -> dict:
    """
    Minimal svensk kvittoparser: merchant (första icke-tomma raden),
    datum, total/summa/att betala, moms, valuta (default SEK).
    """
    out = {"merchant": "", "date": "", "total": "", "vat": "", "currency": "SEK"}

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if lines:
        out["merchant"] = lines[0][:80]

    m_date = re.search(r"\b(\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}|\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b", text)
    if m_date:
        out["date"] = parse_date(m_date.group(1))

    m_total = re.search(r"(?:total|summa|att\s*betala)[^\d]*([\d\s,.]+)\s*(kr|sek)?", text, re.I)
    if m_total:
        out["total"] = m_total.group(1).replace(" ", "").replace(",", ".")

    m_vat = re.search(r"(?:moms|vat)[^\d]*([\d\s,.]+)\s*(kr|sek|%)?", text, re.I)
    if m_vat:
        out["vat"] = m_vat.group(1).replace(" ", "").replace(",", ".")

    if re.search(r"\bsek\b|\bkr\b", text, re.I):
        out["currency"] = "SEK"

    return out

# Request timing decorator
def time_request(f):
    def decorated_function(*args, **kwargs):
        g.start_time = time.time()
        return f(*args, **kwargs)
    return decorated_function

# Health check endpoints
@app.route("/health", methods=["GET"])
def health():
    """Basic health check."""
    return jsonify({
        "ok": True,
        "service": "pdf-ocr",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/livez", methods=["GET"])
def livez():
    """Kubernetes liveness probe."""
    return jsonify({"ok": True, "status": "alive"})

@app.route("/readyz", methods=["GET"])
def readyz():
    """Kubernetes readiness probe."""
    try:
        # Test Tesseract
        pytesseract.get_tesseract_version()
        
        # Test pdfplumber with minimal PDF
        minimal_pdf = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n196\n%%EOF'
        with pdfplumber.open(io.BytesIO(minimal_pdf)) as pdf:
            list(pdf.pages)
            
        return jsonify({
            "ok": True,
            "status": "ready",
            "checks": {
                "tesseract": "ok",
                "pdfplumber": "ok"
            }
        })
    except Exception as e:
        return jsonify({
            "ok": False,
            "status": "not_ready",
            "error": str(e)
        }), 503

@app.route("/metrics", methods=["GET"])
def metrics():
    """Prometheus metrics endpoint."""
    if not PROMETHEUS_ENABLED:
        return jsonify({"error": "Metrics not enabled"}), 404
    
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route("/extract", methods=["POST"])
@time_request
def extract():
    """Main PDF extraction endpoint."""
    try:
        if not validate_api_key():
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="pdf", status="unauthorized").inc()
            return jsonify({
                "ok": False,
                "code": "UNAUTHORIZED",
                "message": "Invalid or missing API key"
            }), 401

        if "file" not in request.files:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="pdf", status="no_file").inc()
            return jsonify({
                "ok": False,
                "code": "NO_FILE",
                "message": "No file provided in form data"
            }), 400

        file = request.files["file"]
        if not file or not file.filename:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="pdf", status="empty_file").inc()
            return jsonify({
                "ok": False,
                "code": "EMPTY_FILE",
                "message": "Empty file"
            }), 400

        pdf_bytes = file.read()

        if len(pdf_bytes) > MAX_UPLOAD_BYTES:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="pdf", status="file_too_large").inc()
            return jsonify({
                "ok": False,
                "code": "FILE_TOO_LARGE",
                "message": f"File too large (> {MAX_UPLOAD_BYTES // (1024*1024)} MB)",
                "details": {"max_size_mb": MAX_UPLOAD_BYTES // (1024*1024)}
            }), 413

        if not (pdf_bytes.startswith(b"%PDF-") or pdf_bytes.startswith(b"%PDF")):
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="pdf", status="invalid_pdf").inc()
            return jsonify({
                "ok": False,
                "code": "INVALID_PDF",
                "message": "Invalid PDF file (missing %PDF- signature)"
            }), 400

        # Query parameters
        lang = request.args.get("lang", DEFAULT_LANG)
        force_ocr = request.args.get("force_ocr", "false").lower() == "true"
        include_raw = request.args.get("include_raw", str(INCLUDE_RAW_DEFAULT).lower()) == "true"

        # Text extraction
        method_used = "text"
        text = ""
        pages_text = 0
        pages_ocr = 0

        if not force_ocr:
            text, pages_text = extract_text_pdfplumber(pdf_bytes)

        if force_ocr or len(text.strip()) < 30:
            ocr_text, pages_ocr = extract_text_ocr(pdf_bytes, lang=lang)
            if ocr_text:
                text = ocr_text
                method_used = "ocr"

        if not text.strip():
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method=method_used, status="no_text_found").inc()
            return jsonify({
                "ok": False,
                "code": "NO_TEXT_FOUND",
                "message": "Could not extract text from PDF"
            }), 400

        # Field extraction
        data = extract_fields_from_text(text)

        # Response preparation
        duration = time.time() - g.start_time
        if PROMETHEUS_ENABLED:
            REQUEST_DURATION.observe(duration)
            REQUEST_COUNT.labels(method=method_used, status="success").inc()

        response_payload = {
            "ok": True,
            "data": data,
            "method": method_used,
            "metrics": {
                "bytes": len(pdf_bytes),
                "pages_pdfplumber": pages_text,
                "pages_ocr": pages_ocr,
                "duration_ms": int(duration * 1000),
            }
        }

        if include_raw:
            response_payload["raw_text"] = text
        else:
            response_payload["preview_text"] = truncate_preview(text, PREVIEW_LEN)

        return jsonify(response_payload)

    except Exception as e:
        duration = time.time() - g.start_time
        if PROMETHEUS_ENABLED:
            REQUEST_COUNT.labels(method="pdf", status="error").inc()
        
        return jsonify({
            "ok": False,
            "code": "EXTRACTION_FAILED",
            "message": f"Text extraction failed: {str(e)}"
        }), 500

@app.route("/extract-image", methods=["POST"])
@time_request
def extract_image():
    """Extract data from receipt images."""
    try:
        if not validate_api_key():
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="image", status="unauthorized").inc()
            return jsonify({"ok": False, "code": "UNAUTHORIZED", "message": "Invalid or missing API key"}), 401

        if "file" not in request.files:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="image", status="no_file").inc()
            return jsonify({"ok": False, "code": "NO_FILE", "message": "No file provided"}), 400

        file = request.files["file"]
        if not file or not file.filename:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="image", status="empty_file").inc()
            return jsonify({"ok": False, "code": "EMPTY_FILE", "message": "Empty file"}), 400

        if file.mimetype not in ALLOWED_IMG:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="image", status="invalid_mime").inc()
            return jsonify({"ok": False, "code": "INVALID_MIME_TYPE", "message": "Only JPG/PNG/WEBP allowed"}), 400

        img_bytes = file.read()
        if len(img_bytes) > MAX_UPLOAD_BYTES:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="image", status="file_too_large").inc()
            return jsonify({
                "ok": False, "code": "FILE_TOO_LARGE", "message": "Image too large",
                "details": {"max_size_mb": MAX_UPLOAD_BYTES // (1024*1024)}
            }), 413

        lang = request.args.get("lang", DEFAULT_LANG)
        mode = request.args.get("mode", "receipt")

        try:
            img = Image.open(io.BytesIO(img_bytes))
        except Exception:
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="image", status="invalid_image").inc()
            return jsonify({"ok": False, "code": "INVALID_IMAGE", "message": "Invalid image data"}), 400

        text = ocr_image(img, lang=lang, mode=mode)
        if not text.strip():
            if PROMETHEUS_ENABLED:
                REQUEST_COUNT.labels(method="image", status="no_text_found").inc()
            return jsonify({
                "ok": False, "code": "NO_TEXT_FOUND",
                "message": "Kunde inte läsa text från bilden. Försök igen i bättre ljus och fyll bildrutan med kvittot."
            }), 400

        receipt = extract_receipt_fields(text)

        duration = time.time() - g.start_time
        if PROMETHEUS_ENABLED:
            REQUEST_DURATION.observe(duration)
            REQUEST_COUNT.labels(method="image", status="success").inc()

        return jsonify({
            "ok": True,
            "data": receipt,
            "method": "ocr",
            "metrics": {
                "bytes": len(img_bytes),
                "pages_pdfplumber": 0,
                "pages_ocr": 1,
                "duration_ms": int(duration * 1000),
            },
            "preview_text": truncate_preview(text, PREVIEW_LEN)
        })

    except Exception as e:
        duration = time.time() - g.start_time
        if PROMETHEUS_ENABLED:
            REQUEST_COUNT.labels(method="image", status="error").inc()
        
        return jsonify({
            "ok": False,
            "code": "EXTRACTION_FAILED",
            "message": f"Image extraction failed: {str(e)}"
        }), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    
    print(f"Starting OCR service on port {port}")
    print(f"Debug mode: {debug}")
    print(f"API key required: {REQUIRE_API_KEY}")
    
    app.run(host="0.0.0.0", port=port, debug=debug)
