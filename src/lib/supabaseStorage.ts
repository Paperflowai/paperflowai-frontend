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
    if (upErr) {
      console.error("Upload error:", upErr);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (error) {
    console.error("Storage error:", error);
    return null;
  }
}

export async function deleteFile(path: string, bucket: string = DEFAULT_BUCKET): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error("Delete error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
}

export async function listFiles(folder: string = "", bucket: string = DEFAULT_BUCKET) {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(folder);
    if (error) {
      console.error("List error:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("List error:", error);
    return [];
  }
}

export async function downloadFile(path: string, bucket: string = DEFAULT_BUCKET): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      console.error("Download error:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Download error:", error);
    return null;
  }
}




