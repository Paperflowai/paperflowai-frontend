import { defaultFlow, type FlowStatus } from "./flowStatus";
import { supabaseAdmin, supabaseAdminConfigured } from "./supabaseServer";

type Row = {
  customer_id: string;
  offer_sent: boolean;
  order_created: boolean;
  order_sent: boolean;
  invoice_created: boolean;
  invoice_sent: boolean;
  invoice_posted: boolean;
  updated_at?: string;
};

const TABLE = "flow_status";

const toStatus = (r: Row | null): FlowStatus =>
  r
    ? {
        offerSent: r.offer_sent,
        orderCreated: r.order_created,
        orderSent: r.order_sent,
        invoiceCreated: r.invoice_created,
        invoiceSent: r.invoice_sent,
        invoicePosted: r.invoice_posted,
      }
    : defaultFlow;

export async function loadFlowStatusServer(
  customerId: string
): Promise<FlowStatus> {
  if (!supabaseAdminConfigured) return defaultFlow;

  const { data, error } = await (supabaseAdmin as any)
    .from(TABLE)
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return toStatus(data ?? null);
}

export async function upsertFlowStatusServer(
  customerId: string,
  patch: Partial<FlowStatus>
): Promise<FlowStatus> {
  const curr = await loadFlowStatusServer(customerId);
  const next: FlowStatus = { ...curr, ...patch };

  if (!supabaseAdminConfigured) return next;

  const { error } = await (supabaseAdmin as any).from(TABLE).upsert(
    {
      customer_id: customerId,
      offer_sent: next.offerSent,
      order_created: next.orderCreated,
      order_sent: next.orderSent,
      invoice_created: next.invoiceCreated,
      invoice_sent: next.invoiceSent,
      invoice_posted: next.invoicePosted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" }
  );

  if (error) throw error;
  return next;
}
