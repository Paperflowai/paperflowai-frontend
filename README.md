# PaperflowAI 🤖📄

Enterprise-grade SaaS platform for small business automation with AI-powered document processing and OCR.

## 🏗️ Architecture (Consolidated)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   OCR Service   │    │   Database      │
│   (Next.js)     │────│   (Flask)       │────│   (Supabase)    │
│   Vercel        │    │   Render        │    │   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
    ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
    │ 2 APIs  │             │ Unified │             │ Auth    │
    │ v1/pdf  │             │ Service │             │ RLS     │
    │ v1/rcpt │             │ OpenCV  │             │ Storage │
    │ Rate    │             │ Tesseract│             │ Realtime│
    │ Limit   │             │ Metrics │             │ Backups │
    └─────────┘             └─────────┘             └─────────┘
```

## 🚀 Quick Start

### Local Development
```bash
# 1. Frontend
git clone <repository>
cd offertplattform
npm install
# Copy environment and fill in Supabase keys before running any commands that hit the API
cp env.example .env.local
# Required values:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
npm run dev  # → http://localhost:3000

# 2. OCR Service (new terminal)
cd pdf-ocr-service
pip install -r requirements.txt
python app.py  # → http://localhost:8000
```

### Test Integration
```bash
# PDF extraction
curl -X POST http://localhost:3000/api/v1/pdf-extract \
  -F "file=@document.pdf"

# Receipt OCR
curl -X POST http://localhost:3000/api/v1/receipt-ocr \
  -F "file=@receipt.jpg"
```

## 🔧 Production Deployment

### Vercel (Frontend)
- **Auto-deploy**: Pushes to main branch
- **Environment**: See `.env.example`
- **Health**: https://your-app.vercel.app/api/v1/pdf-extract

### Render (OCR Service)
- **Root Directory**: `pdf-ocr-service`
- **Build**: `pip install -r requirements.txt`
- **Start**: `gunicorn --bind 0.0.0.0:$PORT app:app`
- **Health**: https://your-ocr.onrender.com/health

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

## 🚑 Troubleshooting

- **Build fails with missing Supabase keys**: Ensure `.env.local` includes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The app only initializes Supabase when these values are present, so missing keys are the primary cause of local build failures.

## 🧪 Testa kundkort med JSON-hook
- Öppna valfritt kundkort i UI.
- Klicka på knappen **"Importera testkund (JSON)"** i sektionen **"Bilder och kladdlappar"** för att ladda `/demo-customers/test-customer.json`. Kunduppgifter fylls automatiskt och en JSON-förhandsvisning placeras som första bild i rutnätet.
- Du kan även ladda upp en egen `.json` via samma filväljare; innehållet tolkas och fälten i Kunduppgifter fylls i för sessionen.

## 🧪 Simulerad flödestest (lokal/demo)
- Kör `npm run simulate:flow` för att verifiera att de lokala kund-hookarna, kundnummergenereringen och flödesstatusarna fungerar även utan Supabase-konfiguration.
- Skriptet skapar en tillfällig kund i `.data/simulation-hooks.json`, markerar offer/order/faktura-flaggor och försöker länka en order-PDF. Utan Supabase service-nycklar kommer länkningen att rapporteras som "skipped" men resten av flödet ska lyckas.
- Efter körning tas testkunden och den temporära lagringsfilen bort så att miljön lämnas ren.

## Notiser
- `src/app/api/ocr/route.ts` returnerar backendens JSON oförändrat och fallbackar till lokalt backend om env saknas.
- `ocr_server/app.py` har CORS och `/health` endpoint för Render.
- Layout/innehåll i existerande sidor är oförändrat.
"# Force Vercel rebuild" 
