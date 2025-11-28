import fs from "fs";
import path from "path";
import {
  generateUniqueCustomerNumber,
  normalizeCustomerNumber,
} from "./customerNumbers";

export type ExternalCustomerPayload = {
  id?: string;
  name: string;
  orgnr?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
  customerNumber?: string | null;
};

export type ExternalCustomerRecord = ExternalCustomerPayload & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_STORE = path.join(process.cwd(), ".data", "customer-hooks.json");

function storePath() {
  return process.env.CUSTOMER_HOOK_STORE_PATH || DEFAULT_STORE;
}

function ensureDirExists(target: string) {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeRead(): ExternalCustomerRecord[] {
  const file = storePath();
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ExternalCustomerRecord[];
    return [];
  } catch (e) {
    console.warn("[customerHookStore] Failed to read store", e);
    return [];
  }
}

function safeWrite(records: ExternalCustomerRecord[]) {
  const file = storePath();
  ensureDirExists(file);
  try {
    fs.writeFileSync(file, JSON.stringify(records, null, 2), "utf8");
  } catch (e) {
    console.warn("[customerHookStore] Failed to write store", e);
  }
}

function normalizeId(record: ExternalCustomerPayload): string {
  if (record.id) return String(record.id);
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `hook-${Date.now()}`;
}

export function listExternalCustomers(): ExternalCustomerRecord[] {
  return safeRead();
}

export function findExternalCustomer(id: string): ExternalCustomerRecord | undefined {
  return safeRead().find((c) => String(c.id) === String(id));
}

export function deleteExternalCustomer(id: string): boolean {
  const records = safeRead();
  const filtered = records.filter((c) => String(c.id) !== String(id));
  if (filtered.length === records.length) return false;
  safeWrite(filtered);
  return true;
}

export function upsertExternalCustomer(
  payload: ExternalCustomerPayload
): ExternalCustomerRecord {
  const records = safeRead();
  const id = normalizeId(payload);
  const now = new Date().toISOString();

  const takenNumbers = new Set<string>(
    records
      .map((c) => normalizeCustomerNumber(c.customerNumber))
      .filter(Boolean) as string[]
  );

  const desiredNumber = normalizeCustomerNumber(payload.customerNumber);
  const resolvedCustomerNumber = desiredNumber
    ? takenNumbers.has(desiredNumber)
      ? generateUniqueCustomerNumber(takenNumbers)
      : desiredNumber
    : generateUniqueCustomerNumber(takenNumbers);

  const idx = records.findIndex((c) => c.id === id);
  const base: ExternalCustomerRecord = {
    ...payload,
    id,
    customerNumber: resolvedCustomerNumber,
    createdAt: now,
    updatedAt: now,
  };

  if (idx >= 0) {
    const prev = records[idx];
    const merged: ExternalCustomerRecord = {
      ...prev,
      ...payload,
      id: prev.id,
      customerNumber: prev.customerNumber || resolvedCustomerNumber,
      createdAt: prev.createdAt || now,
      updatedAt: now,
    };
    records[idx] = merged;
    safeWrite(records);
    return merged;
  }

  records.unshift(base);
  safeWrite(records);
  return base;
}
