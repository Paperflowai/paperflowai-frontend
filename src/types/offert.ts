// src/types/offert.ts

// ============================================================
// OFFER TYPES
// ============================================================
export type OfferItem = {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

export type Offer = {
  offerId: string;
  date: string;       // ISO yyyy-mm-dd
  validUntil?: string;
  currency: string;   // "SEK" etc.
  subtotal: number;
  vatRate: number;    // 0.25
  vatAmount: number;
  total: number;      // subtotal + vatAmount
  items: OfferItem[];
  notes?: string;
  payment?: {
    invoiceRecipient?: string;
    bankgiro?: string;
    method?: string;
  };
  legal?: string;
};

export type Customer = {
  id?: string;
  companyName: string;
  orgNr?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
  offers?: Offer[];
};

export type OfferPayload = {
  offer: Offer;
  customer: Customer;
  seller?: {
    contactPerson?: string;
    email?: string;
  };
};

// ============================================================
// ORDER TYPES
// ============================================================
export type OrderStatus =
  | 'created'      // Order skapad
  | 'sent'         // Order skickad till kund
  | 'confirmed'    // Kund har bekräftat
  | 'in_progress'  // Arbete pågår
  | 'completed'    // Arbete klart
  | 'cancelled';   // Avbruten

export type Order = {
  id: string;
  user_id?: string;
  customer_id: string;
  source_offer_id?: string;
  number: string;              // t.ex. "ORD-2025-0001"
  status: OrderStatus;
  data: any;                   // JSONB - customer info, details, items, etc
  pdf_url?: string;
  storage_path?: string;
  bucket_name?: string;
  total?: number;
  vat_total?: number;
  sent_at?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
};

export type OrderData = {
  customer: {
    companyName: string;
    orgNr?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  details: {
    totalSum: string;
    vatPercent: string;
    vatAmount?: string;
    validityDays?: string;
    offerText?: string;
    items?: OfferItem[];
  };
  number: string;
};

// ============================================================
// INVOICE TYPES
// ============================================================
export type InvoiceStatus =
  | 'created'   // Faktura skapad
  | 'sent'      // Faktura skickad
  | 'paid'      // Betald
  | 'overdue'   // Försenad
  | 'cancelled'; // Avbruten

export type Invoice = {
  id: string;
  user_id?: string;
  customer_id: string;
  source_order_id?: string;
  number: string;              // t.ex. "F-2025-0001"
  status: InvoiceStatus;
  data: any;                   // JSONB - customer info, details, items, etc
  pdf_url?: string;
  storage_path?: string;
  bucket_name?: string;
  total: number;
  vat_total: number;
  due_date?: string;
  paid_at?: string;
  paid_amount?: number;
  exported_to_bookkeeping?: boolean;
  exported_at?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
};

export type InvoiceData = {
  customer: {
    companyName: string;
    orgNr?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  details: {
    totalSum: string;
    vatPercent: string;
    vatAmount: string;
    validityDays?: string;
    offerText?: string;
    items?: OfferItem[];
  };
  number: string;
  dueDate: string;
};
