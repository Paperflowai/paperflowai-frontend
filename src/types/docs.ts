export type DocumentType = 'offer' | 'receipt';

export interface CustomerLite {
  id?: string;
  name?: string;
  orgnr?: string;
  email?: string;
  phone?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
}

export interface BaseDoc {
  document_type: DocumentType;
  customer?: CustomerLite;
  filePath?: string;
}

export interface OfferDoc extends BaseDoc {
  document_type: 'offer';
  customerId: string;
  title: string;
  amount: number;
  currency: string;
  dataJson?: Record<string, unknown> | string;
}

export interface ReceiptDoc extends BaseDoc {
  document_type: 'receipt';
  date?: string; // YYYY-MM-DD
  amount?: number;
  vat?: number;
  currency?: string;
}

export type CreateDocBody = OfferDoc | ReceiptDoc;



