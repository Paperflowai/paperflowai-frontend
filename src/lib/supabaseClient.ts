import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  // Hjälpsam throw i dev – gör inget i prod om du vill
  console.warn("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon);

// Database type definition for TypeScript
export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          org_nr: string;
          contact_person: string;
          phone: string;
          email: string;
          address: string;
          zip: string;
          city: string;
          country: string;
          contact_date: string;
          notes: string;
          customer_number: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          org_nr?: string;
          contact_person?: string;
          phone?: string;
          email?: string;
          address?: string;
          zip?: string;
          city?: string;
          country?: string;
          contact_date?: string;
          notes?: string;
          customer_number?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_name?: string;
          org_nr?: string;
          contact_person?: string;
          phone?: string;
          email?: string;
          address?: string;
          zip?: string;
          city?: string;
          country?: string;
          contact_date?: string;
          notes?: string;
          customer_number?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      bookkeeping_entries: {
        Row: {
          id: string;
          user_id: string;
          customer_id: string;
          invoice_number: string;
          invoice_date: string;
          amount: number;
          currency: string;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          customer_id: string;
          invoice_number: string;
          invoice_date: string;
          amount: number;
          currency?: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          customer_id?: string;
          invoice_number?: string;
          invoice_date?: string;
          amount?: number;
          currency?: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name?: string;
          company_name?: string;
          phone?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          company_name?: string;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          company_name?: string;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};