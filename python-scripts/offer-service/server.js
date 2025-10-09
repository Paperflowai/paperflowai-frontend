import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json({ limit: "10mb" }));
const corsOrigins = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : "*", credentials: true }));

function renderHtml(offer) {
  const currency = offer.currency ?? "SEK";
  const rows = (offer.items ?? []).map(
    it => `<tr><td>${it.name}</td><td>${it.qty}</td><td>${it.price} ${currency}</td></tr>`
  ).join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
  h1 { margin: 0 0 8px; } table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td, th { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
</style></head>
<body>
  <h1>Offert ${offer.title ?? ""}</h1>
  <div>Kund: ${offer.customer?.name ?? "-"}</div>
  <div>Datum: ${offer.date ?? new Date().toISOString().slice(0,10)}</div>
  <table><thead><tr><th>Rad</th><th>Antal</th><th>Pris</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p><strong>Total:</strong> ${offer.amount ?? ""} ${currency}</p>
</body></html>`;
}

app.get("/health", (_, res) => res.json({ ok: true }));

// POST /generate-offer  body: { offer: {...} } eller direkt { ... }
app.post("/generate-offer", async (req, res) => {
  try {
    const offer = req.body?.offer ?? req.body;
    if (!offer) return res.status(400).json({ ok: false, error: "Missing offer payload" });
    const html = renderHtml(offer);

    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm" } });
    await browser.close();

    const pdf_base64 = pdfBuffer.toString("base64");
    return res.json({ ok: true, pdf_base64 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message || "Internal error" });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("offer-service running"));


