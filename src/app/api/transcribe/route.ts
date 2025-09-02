// src/app/api/transcribe/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs"; // behåller Node för form-data uppladdning

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    // Vi tar emot multipart/form-data med ett fält "audio" (filen)
    const form = await req.formData();
    const file = form.get("audio");
    if (!file || !(file instanceof Blob)) {
      return new Response("No audio file provided (form field 'audio')", { status: 400 });
    }

    // Skicka vidare till OpenAI Whisper
    const oaiForm = new FormData();
    // döp filen om den saknar namn
    const namedFile =
      (file as any).name ? file : new File([file], "audio.webm", { type: file.type || "audio/webm" });

    oaiForm.append("file", namedFile);
    oaiForm.append("model", "whisper-1"); // kan bytas till "gpt-4o-transcribe" om du vill
    // Svenska som standard (kan tas bort om du vill autokänna)
    oaiForm.append("language", "sv");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: oaiForm,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(errText || "OpenAI transcription error", { status: 500 });
    }

    const data = await resp.json();
    // OpenAI svarar typ: { text: "..." }
    return Response.json({ text: data.text ?? "" });
  } catch (e: any) {
    return new Response(e?.message || "Server error", { status: 500 });
  }
}
