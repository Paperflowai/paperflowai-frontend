// src/lib/supabaseDatabase.ts
import { supabase } from "./supabaseClient";
import type { Database } from "./supabaseClient";

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

type BookkeepingEntry = Database['public']['Tables']['bookkeeping_entries']['Row'];
type BookkeepingInsert = Database['public']['Tables']['bookkeeping_entries']['Insert'];
type BookkeepingUpdate = Database['public']['Tables']['bookkeeping_entries']['Update'];

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
