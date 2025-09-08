import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          company_name: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
        };
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          org_nr: string | null;
          contact_person: string | null;
          role: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          zip: string | null;
          city: string | null;
          country: string;
          contact_date: string | null;
          notes: string | null;
          customer_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          company_name: string;
          org_nr?: string | null;
          contact_person?: string | null;
          role?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          zip?: string | null;
          city?: string | null;
          country?: string;
          contact_date?: string | null;
          notes?: string | null;
          customer_number?: string | null;
        };
        Update: {
          company_name?: string;
          org_nr?: string | null;
          contact_person?: string | null;
          role?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          zip?: string | null;
          city?: string | null;
          country?: string;
          contact_date?: string | null;
          notes?: string | null;
          customer_number?: string | null;
        };
      };
      bookkeeping_entries: {
        Row: {
          id: string;
          user_id: string;
          customer_id: string | null;
          type: 'invoice' | 'expense';
          supplier_name: string | null;
          customer_name: string | null;
          invoice_no: string | null;
          invoice_date: string;
          amount_incl_vat: number;
          vat_amount: number;
          status: 'Bokförd' | 'Att bokföra';
          file_key: string | null;
          file_mime: string | null;
          public_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          customer_id?: string | null;
          type: 'invoice' | 'expense';
          supplier_name?: string | null;
          customer_name?: string | null;
          invoice_no?: string | null;
          invoice_date: string;
          amount_incl_vat: number;
          vat_amount?: number;
          status?: 'Bokförd' | 'Att bokföra';
          file_key?: string | null;
          file_mime?: string | null;
          public_url?: string | null;
        };
        Update: {
          customer_id?: string | null;
          type?: 'invoice' | 'expense';
          supplier_name?: string | null;
          customer_name?: string | null;
          invoice_no?: string | null;
          invoice_date?: string;
          amount_incl_vat?: number;
          vat_amount?: number;
          status?: 'Bokförd' | 'Att bokföra';
          file_key?: string | null;
          file_mime?: string | null;
          public_url?: string | null;
        };
      };
    };
  };
}
