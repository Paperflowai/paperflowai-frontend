import io, os, re
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pdfminer.high_level import extract_text
import fitz  # PyMuPDF
from paddleocr import PaddleOCR
from PIL import Image
import numpy as np

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr = PaddleOCR(use_angle_cls=True, lang='latin', show_log=False)

def extract_fields(text: str):
    def m(rx):
        r = re.search(rx, text, flags=re.I)
        return r.group(1).strip() if r else None
    return {
        "orgnr": m(r"(?:Org\.?\s*nr|Orgnummer)\s*[:\s]*([0-9]{6}-[0-9]{4}|[0-9]{10})"),
        "datum": m(r"\b(20\d{2}[-/.]\d{2}[-/.]\d{2}|[0-3]?\d[-/.][01]?\d[-/.]20\d{2})\b"),
        "moms": m(r"(?:Moms|Mervärdesskatt|VAT)\s*[:\s]*([0-9.,]+)\s*%?"),
        "total": m(r"(?:Summa|Att\s*betala|Total)\s*[:\s]*([0-9.,]+)\s*(?:SEK|kr)?"),
        "offertnr": m(r"Offert(?:nr|nummer)?\s*[:#]?\s*([A-Za-z0-9-]+)"),
        "giltig_tom": m(r"Giltig(?:t)?\s*t\.?o\.?m\.?\s*[:\s]*([0-9./-]+)")
    }

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    raw = await file.read()
    # Försök 1: textlager
    try:
        text = extract_text(io.BytesIO(raw)) or ""
    except Exception:
        text = ""
    if len(text.strip()) > 50:
        return {"ok": True, "method": "text", "fields": extract_fields(text), "text": text}
    # Fallback OCR per sida
    doc = fitz.open(stream=raw, filetype="pdf")
    pages = []
    for page in doc:
        pix = page.get_pixmap(dpi=200)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        arr = np.array(img)
        res = ocr.ocr(arr, cls=True)
        page_text = " ".join([line[1][0] for line in (res[0] or [])])
        pages.append(page_text)
    merged = "\n".join(pages)
    return {"ok": True, "method": "ocr", "fields": extract_fields(merged), "text": merged}

@app.post("/ocr-image")
async def ocr_image(file: UploadFile = File(...)):
    raw = await file.read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(img)
    res = ocr.ocr(arr, cls=True)
    text = " ".join([line[1][0] for line in (res[0] or [])])
    return {"ok": True, "method": "ocr", "fields": extract_fields(text), "text": text}


