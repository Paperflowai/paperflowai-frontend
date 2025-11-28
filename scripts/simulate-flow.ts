import fs from "fs";
import path from "path";
import { assignCustomerNumbers } from "../src/lib/customerNumbers";
import {
  deleteExternalCustomer,
  listExternalCustomers,
  upsertExternalCustomer,
} from "../src/lib/customerHookStore";
import { defaultFlow } from "../src/lib/flowStatus";
import { loadFlowStatusServer, upsertFlowStatusServer } from "../src/lib/flowStatusServer";
import { linkDocumentRecord } from "../src/lib/documentLinks";
import { supabaseAdminConfigured } from "../src/lib/supabaseServer";

async function simulate() {
  const storePath = path.join(process.cwd(), ".data", "simulation-hooks.json");
  process.env.CUSTOMER_HOOK_STORE_PATH = storePath;

  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);

  const created = upsertExternalCustomer({
    name: "Simulerad Kund",
    email: "simulerad@example.com",
    notes: "Automatisk testkörning",
  });

  const numbered = assignCustomerNumbers([
    { ...created, id: created.id ?? created.customerNumber },
  ])[0];

  const customerId = String(numbered.id || numbered.customerNumber);
  const flowBefore = await loadFlowStatusServer(customerId).catch(() => defaultFlow);
  const flowAfter = await upsertFlowStatusServer(customerId, {
    offerSent: true,
    orderCreated: true,
    invoiceCreated: true,
  }).catch(() => flowBefore);

  const linkAttempt = await linkDocumentRecord({
    table: "orders",
    customerId,
    storagePath: `sim-orders/${customerId}.pdf`,
    bucket: "paperflow-files",
    number: numbered.customerNumber,
    status: "simulated",
  });

  let documentLinking: string;
  if (linkAttempt.ok) {
    documentLinking = "linked";
  } else {
    const reason =
      "error" in linkAttempt && linkAttempt.error
        ? (linkAttempt.error as any).message ||
          JSON.stringify(linkAttempt.error)
        : "unknown";
    documentLinking = `skipped: ${reason}`;
  }

  const deleted = deleteExternalCustomer(created.id);
  const remaining = listExternalCustomers().length;
  if (fs.existsSync(storePath)) fs.unlinkSync(storePath);

  const rank = supabaseAdminConfigured
    ? "Production-ready with Supabase"
    : "Demo/local mode (Supabase disabled)";

  const report = {
    rank,
    supabaseConfigured: supabaseAdminConfigured,
    customer: {
      createdId: created.id,
      customerNumber: numbered.customerNumber,
      wasGenerated: created.customerNumber !== numbered.customerNumber,
    },
    flow: {
      before: flowBefore,
      after: flowAfter,
    },
    documentLinking,
    cleanup: {
      deleted,
      remaining,
      storeExists: fs.existsSync(storePath),
      storePath,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

simulate().catch((err) => {
  console.error("[simulate-flow] failed", err);
  process.exit(1);
});
