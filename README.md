# Offertplattform – lokal körning och OCR

## Lokalt

1. Installera JS-beroenden
```bash
npm install
```
2. Starta Next.js (http://localhost:3000)
```bash
npm run dev
```
3. Starta Python OCR-backend i en annan terminal
```bash
cd ocr_server
python -m venv .venv && .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python app.py
```
4. Testa
- Öppna `http://localhost:3000/ocr-test`
- Välj en bild (kvitto). Frontend POST:ar till `/api/ocr` → proxar till `http://127.0.0.1:5000/ocr` (fallback)

## Produktion

- Frontend: Vercel (Next 15, app router)
- Backend: Render Web Service (root: `ocr_server`)

Render:
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn -w 1 -k gthread -b 0.0.0.0:$PORT app:app`
- Hälsa: `GET /health` → `{ "ok": true }`

Vercel env:
- `PYTHON_OCR_URL = https://<render-service>.onrender.com/ocr`

## cURL

Lokalt via Next-proxyn:
```bash
curl -X POST http://localhost:3000/api/ocr \
  -F "file=@ocr_server/test.jpg"
```
Direkt mot backend lokalt:
```bash
curl -X POST http://127.0.0.1:5000/ocr \
  -F "file=@ocr_server/test.jpg"
```

## Notiser
- `src/app/api/ocr/route.ts` returnerar backendens JSON oförändrat och fallbackar till lokalt backend om env saknas.
- `ocr_server/app.py` har CORS och `/health` endpoint för Render.
- Layout/innehåll i existerande sidor är oförändrat.
"# Force Vercel rebuild" 
