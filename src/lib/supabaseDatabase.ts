// src/lib/supabaseDatabase.ts
import { supabase } from "./supabaseClient";

// Simple type definitions without Database dependency
type Customer = {
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

type CustomerInsert = {
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

type CustomerUpdate = {
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

type BookkeepingEntry = {
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

type BookkeepingInsert = {
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

type BookkeepingUpdate = {
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

// Customer functions
export async function getCustomers(userId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
  return data || [];
}

export async function createCustomer(customer: CustomerInsert): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    return null;
  }
  return data;
}

export async function updateCustomer(id: string, updates: CustomerUpdate): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating customer:', error);
    return null;
  }
  return data;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting customer:', error);
    return false;
  }
  return true;
}

// Bookkeeping functions
export async function getBookkeepingEntries(userId: string): Promise<BookkeepingEntry[]> {
  const { data, error } = await supabase
    .from('bookkeeping_entries')
    .select('*')
    .eq('user_id', userId)
    .order('invoice_date', { ascending: false });

  if (error) {
    console.error('Error fetching bookkeeping entries:', error);
    return [];
  }
  return data || [];
}

export async function createBookkeepingEntry(entry: BookkeepingInsert): Promise<BookkeepingEntry | null> {
  const { data, error } = await supabase
    .from('bookkeeping_entries')
    .insert(entry)
    .select()
    .single();

  if (error) {
    console.error('Error creating bookkeeping entry:', error);
    return null;
  }
  return data;
}

export async function updateBookkeepingEntry(id: string, updates: BookkeepingUpdate): Promise<BookkeepingEntry | null> {
  const { data, error } = await supabase
    .from('bookkeeping_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating bookkeeping entry:', error);
    return null;
  }
  return data;
}

export async function deleteBookkeepingEntry(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('bookkeeping_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting bookkeeping entry:', error);
    return false;
  }
  return true;
}

// Profile functions
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}

export async function createProfile(profile: { id: string; email: string; full_name?: string; company_name?: string; phone?: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    return null;
  }
  return data;
}

export async function updateProfile(userId: string, updates: { full_name?: string; company_name?: string; phone?: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return null;
  }
  return data;
}

// Real-time subscriptions
export function subscribeToCustomers(userId: string, callback: (customers: Customer[]) => void) {
  return supabase
    .channel('customers')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'customers',
        filter: `user_id=eq.${userId}`
      }, 
      () => {
        getCustomers(userId).then(callback);
      }
    )
    .subscribe();
}

export function subscribeToBookkeeping(userId: string, callback: (entries: BookkeepingEntry[]) => void) {
  return supabase
    .channel('bookkeeping')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'bookkeeping_entries',
        filter: `user_id=eq.${userId}`
      }, 
      () => {
        getBookkeepingEntries(userId).then(callback);
      }
    )
    .subscribe();
}
