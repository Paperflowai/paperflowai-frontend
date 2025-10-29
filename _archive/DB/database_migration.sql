-- Create/update tables for offert → order → faktura → bokföring flow
-- Run this in Supabase SQL Editor

-- Enable necessary extensions if not exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  number TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  data JSONB DEFAULT '{}',
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table 
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  number TEXT,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed')),
  data JSONB DEFAULT '{}',
  pdf_url TEXT,
  source_offer_id UUID REFERENCES public.offers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  number TEXT,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'sent', 'paid', 'exported', 'overdue')),
  data JSONB DEFAULT '{}',
  pdf_url TEXT,
  source_order_id UUID REFERENCES public.orders(id),
  due_date DATE,
  total NUMERIC(10,2),
  vat_total NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_offers_customer_id ON public.offers(customer_id);
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON public.offers(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

