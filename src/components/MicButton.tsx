// src/components/MicButton.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function MicButton({
  onText,
  className = "",
  labelIdle = "🎤",
  labelRec = "■",
}: {
  onText: (text: string) => void;
  className?: string;
  labelIdle?: string;
  labelRec?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      try {
        mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
    } catch (e) {
      alert("Kunde inte initiera mikrofon. Kontrollera behörigheter.");
    }
  }

  async function stopRec() {
    const rec = mediaRef.current;
    if (!rec) return;
    return new Promise<void>((resolve) => {
      rec.onstop = async () => {
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData();
          // Viktigt: fältnamnet "audio" matchar /api/transcribe
          fd.append("audio", blob, "audio.webm");
          const resp = await fetch("/api/transcribe", { method: "POST", body: fd });
          const data = await resp.json();
          if (data?.text) onText(data.text);
        } catch {
          alert("Kunde inte transkribera ljudet.");
        } finally {
          setBusy(false);
          resolve();
        }
      };
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      mediaRef.current = null;
    });
  }

  async function toggle() {
    if (busy) return;
    if (!recording) await startRec();
    else await stopRec();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-xl px-3 py-2 font-medium ${
        recording
          ? "bg-red-600 text-white"
          : "bg-gray-200 hover:bg-gray-300 text-gray-900"
      } ${className}`}
      title={recording ? "Stoppa inspelning" : "Spela in röst"}
    >
      {recording ? labelRec : labelIdle}
    </button>
  );
}
