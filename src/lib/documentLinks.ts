import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabaseServer";

export type LinkPayload = {
  table: "orders" | "invoices";
  customerId: string;
  storagePath: string;
  bucket?: string;
  fileUrl?: string | null;
  status?: string;
  sourceOfferId?: string | null;
  sourceOfferPath?: string | null;
  sourceOrderId?: string | null;
  sourceOrderPath?: string | null;
  number?: string | null;
};

type AttemptResult = { ok: true; data: any; shape: Record<string, any> } | { ok: false; error: any };

const compact = (obj: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );

export async function linkDocumentRecord(payload: LinkPayload): Promise<AttemptResult> {
  if (!supabaseAdminConfigured) {
    return { ok: false, error: new Error("Supabase admin not configured") };
  }

  const now = new Date().toISOString();
  const base = {
    status: payload.status ?? "created",
    bucket: payload.bucket ?? null,
    bucket_name: payload.bucket ?? null,
    storage_path: payload.storagePath,
    file_url: payload.fileUrl ?? null,
    number: payload.number ?? null,
    created_at: now,
    updated_at: now,
  };

  const shapes: Record<string, any>[] = [
    {
      customer_id: payload.customerId,
      source_offer_id: payload.sourceOfferId ?? null,
      source_offer_path: payload.sourceOfferPath ?? null,
      source_order_id: payload.sourceOrderId ?? null,
      source_order_path: payload.sourceOrderPath ?? null,
      ...base,
    },
    {
      customerId: payload.customerId,
      sourceOfferId: payload.sourceOfferId ?? null,
      sourceOfferPath: payload.sourceOfferPath ?? null,
      sourceOrderId: payload.sourceOrderId ?? null,
      sourceOrderPath: payload.sourceOrderPath ?? null,
      storagePath: payload.storagePath,
      bucketName: payload.bucket ?? null,
      url: payload.fileUrl ?? null,
      status: payload.status ?? "created",
      createdAt: now,
      updatedAt: now,
    },
    {
      customer_id: payload.customerId,
      path: payload.storagePath,
      bucket: payload.bucket ?? null,
      url: payload.fileUrl ?? null,
      status: payload.status ?? "created",
      source: payload.sourceOfferPath ?? payload.sourceOrderPath ?? null,
      created_at: now,
      updated_at: now,
    },
  ];

  let lastError: any = null;
  for (const shape of shapes) {
    const attempt = await supabaseAdmin
      .from(payload.table)
      .upsert(compact(shape))
      .select()
      .maybeSingle();

    if (!attempt.error) {
      return { ok: true, data: attempt.data, shape };
    }

    lastError = attempt.error;
  }

  return { ok: false, error: lastError };
}
