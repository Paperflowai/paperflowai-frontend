# src/app/python-ocr/backend/ocr_server.py
from flask import Flask, request, jsonify
import numpy as np, cv2, easyocr

app = Flask(__name__)
reader = easyocr.Reader(['sv','en'], gpu=False)  # ladda en gång

@app.get("/health")
def health():
    return jsonify(ok=True)

@app.post("/ocr")
def ocr():
    f = request.files.get('file')
    if not f:
        return jsonify(ok=False, error="file_missing"), 400

    data = f.read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return jsonify(ok=False, error="decode_failed"), 400

    # skala ned jättestora bilder lite för stabilitet
    h, w = img.shape[:2]
    if max(w, h) > 1600:
        s = 1600 / max(w, h)
        img = cv2.resize(img, (int(w*s), int(h*s)))

    lines = reader.readtext(img, detail=0, paragraph=False)  # bara textrader
    return jsonify(ok=True, text="\n".join(lines), lines=lines)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
