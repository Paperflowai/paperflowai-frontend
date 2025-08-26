// src/lib/supabaseStorage.ts
import { supabase } from "./supabaseClient";

const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "paperflow";

export async function uploadPublicBlob(path: string, blob: Blob, contentType?: string): Promise<string | null> {
  try {
    const bucket = DEFAULT_BUCKET;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
      upsert: true,
      contentType: contentType || "application/octet-stream",
      cacheControl: "3600",
    });
    if (upErr) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}
