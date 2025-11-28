import { supabase, supabaseConfigured } from "@/lib/supabaseClient";

export type FlowStatus = {
  offerSent: boolean;
  orderCreated: boolean;
  orderSent: boolean;
  invoiceCreated: boolean;
  invoiceSent: boolean;
  invoicePosted: boolean;
};

export const defaultFlow: FlowStatus = {
  offerSent: false,
  orderCreated: false,
  orderSent: false,
  invoiceCreated: false,
  invoiceSent: false,
  invoicePosted: false,
};

type Row = {
  customer_id: string; // UUID as string
  offer_sent: boolean;
  order_created: boolean;
  order_sent: boolean;
  invoice_created: boolean;
  invoice_sent: boolean;
  invoice_posted: boolean;
  updated_at: string;
};

const TABLE = "flow_status";

const LOCAL_FLOW_PREFIX = "flow_status:";

const readLocalFlowStatus = (customerId: string): FlowStatus => {
  if (typeof localStorage === "undefined") return defaultFlow;
  try {
    const raw = localStorage.getItem(`${LOCAL_FLOW_PREFIX}${customerId}`);
    return raw ? { ...defaultFlow, ...JSON.parse(raw) } : defaultFlow;
  } catch {
    return defaultFlow;
  }
};

const writeLocalFlowStatus = (customerId: string, status: FlowStatus) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${LOCAL_FLOW_PREFIX}${customerId}`, JSON.stringify(status));
  } catch {
    // swallow
  }
};

const toStatus = (r: Row | null): FlowStatus =>
  r ? ({
    offerSent: r.offer_sent,
    orderCreated: r.order_created,
    orderSent: r.order_sent,
    invoiceCreated: r.invoice_created,
    invoiceSent: r.invoice_sent,
    invoicePosted: r.invoice_posted
  }) : defaultFlow;

export async function loadFlowStatus(customerId: string): Promise<FlowStatus> {
  if (!supabaseConfigured) return readLocalFlowStatus(customerId);

  const { data, error } = await supabase
    .from<Row>(TABLE)
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return toStatus(data ?? null);
}

export async function upsertFlowStatus(customerId: string, patch: Partial<FlowStatus>): Promise<FlowStatus> {
  const curr = await loadFlowStatus(customerId);
  const next: FlowStatus = { ...curr, ...patch };

  if (!supabaseConfigured) {
    writeLocalFlowStatus(customerId, next);
    return next;
  }

  const { error } = await supabase.from(TABLE).upsert({
    customer_id: customerId,
    offer_sent: next.offerSent,
    order_created: next.orderCreated,
    order_sent: next.orderSent,
    invoice_created: next.invoiceCreated,
    invoice_sent: next.invoiceSent,
    invoice_posted: next.invoicePosted
  }, { onConflict: "customer_id" });
  if (error) throw error;
  return next;
}
