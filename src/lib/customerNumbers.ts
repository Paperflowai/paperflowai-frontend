export type CustomerWithNumber = {
  id?: string | number | null;
  customerNumber?: string | null;
};

function cleanNumber(value?: string | null): string {
  return (value || "").trim().toUpperCase();
}

export function normalizeCustomerNumber(value?: string | null): string {
  return cleanNumber(value);
}

export function generateUniqueCustomerNumber(taken?: Set<string>): string {
  const used = taken || new Set<string>();
  let candidate = "";
  let attempts = 0;
  do {
    candidate = `K-${Math.floor(100000 + Math.random() * 900000)}`;
    attempts += 1;
  } while (used.has(candidate) && attempts < 2000);
  used.add(candidate);
  return candidate;
}

export function collectCustomerNumbersFromLocalStorage(): Set<string> {
  if (typeof localStorage === "undefined") return new Set<string>();

  const collected = new Set<string>();

  try {
    const raw = localStorage.getItem("paperflow_customers_v1");
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((c: any) => {
          const num = cleanNumber(c?.customerNumber);
          if (num) collected.add(num);
        });
      }
    }
  } catch (err) {
    console.warn("[customerNumbers] Failed to read paperflow_customers_v1", err);
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("kund_")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const num = cleanNumber(parsed?.customerNumber);
      if (num) collected.add(num);
    }
  } catch (err) {
    console.warn("[customerNumbers] Failed to scan kund_ keys", err);
  }

  return collected;
}

export function assignCustomerNumbers<T extends CustomerWithNumber & { id?: string | number | null }>(
  customers: T[],
  options?: {
    taken?: Set<string>;
    onAssign?: (customer: T & { customerNumber: string; isGenerated: boolean }) => void;
  }
): (T & { customerNumber: string })[] {
  const seeded = options?.taken ?? new Set<string>();
  const ownerMap = new Map<string, string>();

  const claim = (num: string, owner: string) => {
    seeded.add(num);
    ownerMap.set(num, owner);
  };

  customers.forEach((c) => {
    const num = cleanNumber(c.customerNumber);
    const owner = String(c.id ?? num ?? "");
    if (num && !ownerMap.has(num)) {
      claim(num, owner);
    }
  });

  const used = new Set(seeded);

  return customers.map((customer) => {
    const num = cleanNumber(customer.customerNumber);
    const ownerId = String(customer.id ?? customer.customerNumber ?? "");
    const existingOwner = num ? ownerMap.get(num) : undefined;
    const needsNew = !num || (existingOwner && existingOwner !== ownerId);

    let finalNumber = num;
    let generated = false;

    if (needsNew) {
      finalNumber = generateUniqueCustomerNumber(used);
      generated = true;
      claim(finalNumber, ownerId || finalNumber);
    } else if (num && !used.has(num)) {
      claim(num, ownerId || num);
      used.add(num);
    }

    const result = {
      ...customer,
      customerNumber: finalNumber || generateUniqueCustomerNumber(used),
    } as T & { customerNumber: string };

    if ((generated || needsNew) && options?.onAssign) {
      options.onAssign(result as T & { customerNumber: string; isGenerated: boolean });
    }

    return result;
  });
}
