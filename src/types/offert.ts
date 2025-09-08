// src/types/offert.ts
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
