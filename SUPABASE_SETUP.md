# Supabase Setup Guide

## 1. Skapa Supabase Projekt

1. Gå till [supabase.com](https://supabase.com)
2. Klicka "Start your project"
3. Logga in med GitHub
4. Klicka "New Project"
5. Välj organisation och namnge projektet (t.ex. "paperflowai")
6. Välj region (Stockholm för bästa prestanda i Sverige)
7. Välj lösenord för databasen
8. Klicka "Create new project"

## 2. Konfigurera Environment Variables

Skapa `.env.local` filen i projektets root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_BUCKET=paperflow
NEXT_PUBLIC_DISABLE_AUTH=1

# OpenAI Configuration (för framtida GPT-integration)
OPENAI_API_KEY=your_openai_api_key

# OCR Backend
PYTHON_OCR_URL=http://127.0.0.1:5000/ocr

# Email Configuration
RESEND_API_KEY=your_resend_api_key
```

### Hitta dina Supabase-nycklar:

1. Gå till ditt Supabase-projekt
2. Klicka på "Settings" (kugghjul-ikonen)
3. Klicka på "API"
4. Kopiera:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Skapa Database Schema

1. Gå till ditt Supabase-projekt
2. Klicka på "SQL Editor" i vänster meny
3. Klicka "New query"
4. Kopiera innehållet från `supabase-schema.sql`
5. Klicka "Run" för att köra SQL:en

## 4. Konfigurera Storage Buckets

1. Gå till "Storage" i vänster meny
2. Klicka "Create a new bucket"
3. Skapa följande buckets:

### Bucket 1: `paperflow`
- **Name**: paperflow
- **Public**: ✅ (för att kunna komma åt filer via URL)
- **File size limit**: 50MB
- **Allowed MIME types**: image/*, application/pdf

### Bucket 2: `attachments`
- **Name**: attachments  
- **Public**: ✅
- **File size limit**: 10MB
- **Allowed MIME types**: image/*, application/pdf

### Bucket 3: `exports`
- **Name**: exports
- **Public**: ✅
- **File size limit**: 20MB
- **Allowed MIME types**: application/pdf

## 5. Konfigurera Authentication

1. Gå till "Authentication" → "Settings"
2. Under "Site URL" lägg till:
   - `http://localhost:3000` (för utveckling)
   - `https://your-vercel-app.vercel.app` (för produktion)
3. Under "Redirect URLs" lägg till samma URLs

## 6. Testa Installationen

1. Starta utvecklingsservern:
   ```bash
   npm run dev
   ```

2. Gå till `http://localhost:3000/login`
3. Skapa ett testkonto
4. Kontrollera att du kan logga in och se dashboarden

## 7. Produktionssetup

### Vercel (Frontend):
1. Koppla ditt GitHub-repo till Vercel
2. Lägg till environment variables i Vercel dashboard
3. Deploy

### Render (Backend):
1. Skapa ny Web Service på Render
2. Koppla till GitHub-repo
3. Välj Python som runtime
4. Lägg till environment variables
5. Deploy

## 8. Säkerhet

### Row Level Security (RLS):
- Alla tabeller har RLS aktiverat
- Användare kan bara se sina egna data
- Policies är konfigurerade i SQL-schemat

### API Keys:
- Använd aldrig service role key i frontend
- Använd bara anon key för klient-sida
- Service role key ska bara användas i server-side kod

## 9. Monitoring

- Gå till "Logs" för att se API-anrop
- Gå till "Database" → "Logs" för databasaktiviteter
- Använd "Metrics" för prestandaövervakning

## 10. Backup

- Supabase skapar automatiskt dagliga backups
- Du kan också skapa manuella backups via dashboard
- Exportera data via SQL Editor om nödvändigt

## Troubleshooting

### Vanliga problem:

1. **CORS-fel**: Kontrollera att Site URL är korrekt konfigurerad
2. **RLS-fel**: Kontrollera att användaren är inloggad
3. **Storage-fel**: Kontrollera bucket-permissions
4. **Auth-fel**: Kontrollera redirect URLs

### Debug-tips:

1. Använd browser dev tools för att se fel
2. Kontrollera Supabase logs
3. Testa API-anrop i Supabase dashboard
4. Använd `console.log` för att debugga data
