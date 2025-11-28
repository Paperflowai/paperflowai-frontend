// src/lib/storage.ts
export const BUCKET_DOCS = "offers";
export const OFFER_BUCKET = 'paperflow-files'; // byt till vårt riktiga bucket-namn om annat
// --- Wrapper to keep old import name from dashboard/page.tsx ---
import { supabase, supabaseConfigured } from "./supabaseClient";

/**
 * Upload a Blob to a public Supabase Storage bucket and return its public URL.
 * Usage matches previous 'uploadPublicBlob' import in dashboard/page.tsx.
 */
export async function uploadPublicBlob(
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string = "application/octet-stream",
): Promise<string> {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured. Skipping upload and keeping files local only.");
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType });

  if (error) {
    throw error;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
