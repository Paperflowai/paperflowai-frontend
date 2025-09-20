"use server";

import { createClient } from "@supabase/supabase-js";

type Extracted = {
  company_name?: string; 
  customer_number?: string; 
  contact_person?: string;
  email?: string; 
  phone?: string; 
  address?: string; 
  zip?: string; 
  city?: string;
  orgnr?: string; 
  date?: string; 
  position?: string; 
  country?: string;
};

export async function importOfferPdfToCustomer(file: File, customerId: string) {
  const form = new FormData();
  form.append("file", file);

  // Använd befintlig PDF-extract endpoint (ingen OCR forcerad)
  const api = process.env.NEXT_PUBLIC_PDF_API_URL ?? "/api/v1/pdf-extract";
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "http://localhost:3000";
    
  const res = await fetch(`${baseUrl}${api}?lang=swe+eng`, { 
    method: "POST", 
    body: form,
    headers: {
      // Lägg till API-nyckel om konfigurerad
      ...(process.env.PDF_API_KEY && { 'X-Api-Key': process.env.PDF_API_KEY })
    }
  });
  
  const json = await res.json() as { 
    ok: boolean; 
    data?: Extracted; 
    message?: string;
    method?: string;
  };

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.message || "PDF extraction failed");
  }

  // Använd server-only Supabase klient
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Uppdatera kundkort med extraherade data
  const { error } = await supabase
    .from("customers")
    .update({
      company_name: json.data.company_name ?? null,
      email: json.data.email ?? null,
      phone: json.data.phone ?? null,
      address: json.data.address ?? null,
      zip: json.data.zip ?? null,
      city: json.data.city ?? null,
      org_nr: json.data.orgnr ?? null,
      contact_person: json.data.contact_person ?? null,
      customer_number: json.data.customer_number ?? null,
      country: json.data.country ?? null,
      role: json.data.position ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("id", customerId);

  if (error) {
    console.error('Supabase update error:', error);
    throw new Error(`Failed to update customer: ${error.message}`);
  }

  // Logga framgångsrik import
  console.log(JSON.stringify({
    event: 'pdf_import_success',
    customer_id: customerId,
    method: json.method,
    fields_imported: Object.keys(json.data).filter(k => json.data![k as keyof Extracted])
  }));

  return json.data;
}
