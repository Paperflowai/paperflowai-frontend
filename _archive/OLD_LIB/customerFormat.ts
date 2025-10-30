export type DisplayCustomer = {
  name?: string | null;
  orgnr?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  // optional extras that may arrive from parsed offer JSON
  customerNumber?: string | null;
  contactPerson?: string | null;
  position?: string | null;
  dateISO?: string | null; // yyyy-mm-dd
};

function val(v: unknown): string {
  if (v === undefined || v === null || v === "") return "-";
  return String(v);
}

export function formatCustomerLines(c: DisplayCustomer) {
  const lines = [
    { label: "Företagsnamn", value: val(c.name) },
    { label: "Kundnummer", value: val(c.customerNumber) },
    { label: "Kontaktperson", value: val(c.contactPerson) },
    { label: "E-post", value: val(c.email) },
    { label: "Telefon", value: val(c.phone) },
    { label: "Adress", value: val(c.address) },
    { label: "Postnummer", value: val(c.zip) },
    { label: "Ort", value: val(c.city) },
    { label: "Org.nr", value: val(c.orgnr) },
    { label: "Datum", value: formatDate(c.dateISO) },
    { label: "Befattning", value: val(c.position) },
    { label: "Land", value: val(c.country ?? "Sverige") },
  ];
  return lines;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("sv-SE");
  } catch {
    return iso;
  }
}





