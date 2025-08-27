from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2, io, re, base64, gc
from PIL import Image

# HEIC-stöd (om installerat). Annars ignoreras det.
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pillow_heif = None

import easyocr
# Viktigt: liten batch för att spara minne
reader = easyocr.Reader(['sv','en'], gpu=False)
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route("/health")
def health():
    return {"ok": True}

def decode_image(file_bytes: bytes, mimetype=None, filename=None):
    """Läs bild från bytes. JPG/PNG/WebP funkar direkt. HEIC via Pillow om möjligt."""
    name = (filename or "").lower()
    is_heic = (name.endswith(".heic") or (mimetype and "heic" in mimetype))
    if is_heic and pillow_heif:
        try:
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        except Exception:
            return None
    arr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

def ensure_portrait(img):
    """Rotera till stående läge om kvittot verkar ligga på sidan."""
    if img is None:
        return None
    h, w = img.shape[:2]
    if w > h * 1.15:
        # rotera 90 grader medurs
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    return img

def preprocess_basic(img, max_side=1200):
    """Skala ner + gråskala + mild denoise."""
    if img is None:
        return None
    h, w = img.shape[:2]
    m = max(h, w)
    if m > max_side:
        scale = max_side / float(m)
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, d=5, sigmaColor=60, sigmaSpace=60)
    return gray

def preprocess_variants(img_gray):
    """Skapa flera varianter (threshold/kontrast) för robusthet."""
    if img_gray is None:
        return []
    variants = []
    # 1) Ren grå
    variants.append(cv2.cvtColor(img_gray, cv2.COLOR_GRAY2BGR))
    # 2) CLAHE (lokal kontrast)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(img_gray)
    variants.append(cv2.cvtColor(cl, cv2.COLOR_GRAY2BGR))
    # 3) Adaptiv threshold (mean)
    at = cv2.adaptiveThreshold(img_gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 31, 10)
    variants.append(cv2.cvtColor(at, cv2.COLOR_GRAY2BGR))
    # 4) Otsu
    _, otsu = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(cv2.cvtColor(otsu, cv2.COLOR_GRAY2BGR))
    return variants

def run_easyocr_best(img_variants):
    """Kör EasyOCR på olika varianter och returnera bäst text."""
    best = {"text": "", "lines": [], "score": -1}
    for v in img_variants:
        try:
            # Prova två magnifieringsgrader
            for mag in (1.0, 1.5):
                lines = reader.readtext(
                    v,
                    detail=0,
                    batch_size=1,
                    canvas_size=1280,
                    mag_ratio=mag,
                    paragraph=True,
                )
                raw_text = "\n".join([l for l in lines if str(l).strip()])
                # poäng: antal tecken + antal rader
                score = len(raw_text) + 5 * len(lines)
                if score > best["score"]:
                    best = {"text": raw_text, "lines": lines, "score": score}
        except Exception:
            continue
    return best

@app.route("/ocr", methods=["POST"])
def ocr():
    # 1) multipart/form-data (fält: "file")
    if "file" in request.files:
        f = request.files["file"]
        file_bytes = f.read()
        filename = f.filename
        mimetype = f.mimetype
    else:
        # 2) JSON { "imageBase64": "data:image/...;base64,..." }
        data = request.get_json(silent=True) or {}
        b64 = data.get("imageBase64")
        if not b64:
            return jsonify({
                "ok": False, "error": "NO_FILE",
                "message": "Skicka en bild som multipart/form-data (fält: 'file') eller 'imageBase64' i JSON."
            }), 400
        try:
            header, payload = (b64.split(",", 1) if "," in b64 else ("", b64))
            file_bytes = base64.b64decode(payload)
            filename, mimetype = None, None
        except Exception as e:
            return jsonify({"ok": False, "error": "BASE64_DECODE_FAILED", "message": str(e)}), 400

    if not file_bytes or len(file_bytes) < 10:
        return jsonify({"ok": False, "error": "EMPTY_FILE", "message": "Filen verkar tom."}), 400

    img = decode_image(file_bytes, mimetype, filename)
    if img is None:
        return jsonify({
            "ok": False, "error": "DECODE_FAILED",
            "message": "Bilden kunde inte läsas. Är det HEIC? Installera pillow-heif eller skicka JPG/PNG."
        }), 415

    # Orientera och förbehandla
    img = ensure_portrait(img)
    gray = preprocess_basic(img, max_side=1400)
    variants = preprocess_variants(gray)

    try:
        best = run_easyocr_best(variants)
        raw_text = best["text"].strip()

        # Enkel parsning av företag, total, moms
        lower_skip = ["kvitto", "receipt", "total", "summa", "moms", "vat", "belopp", "inkl", "exkl"]
        company = ""
        for l in best["lines"]:
            ll = str(l).lower()
            if any(w in ll for w in lower_skip):
                continue
            if any(c.isalpha() for c in str(l)):
                company = str(l).strip()
                break

        nums = re.findall(r'(\d{1,4}[.,]\d{2})', raw_text)
        nums_norm = [float(n.replace('.', '').replace(',', '.')) for n in nums] if nums else []
        total = max(nums_norm) if nums_norm else None

        vat = None
        for l in raw_text.splitlines():
            if "moms" in l.lower() or "vat" in l.lower():
                m = re.search(r'(\d{1,4}[.,]\d{2})', l)
                if m:
                    vat = float(m.group(1).replace('.', '').replace(',', '.'))
                    break

        gc.collect()
        return jsonify({"ok": True, "company": company, "total": total, "vat": vat, "raw_text": raw_text})
    except Exception as e:
        gc.collect()
        return jsonify({"ok": False, "error": "OCR_FAILED", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)

