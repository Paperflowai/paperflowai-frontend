-- Create the public.offers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id text NOT NULL,
    title text,
    amount numeric,
    currency text DEFAULT 'SEK',
    file_url text NOT NULL,
    needs_print boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create an index on customer_id for better query performance
CREATE INDEX IF NOT EXISTS idx_offers_customer_id ON public.offers(customer_id);

-- Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON public.offers(created_at);

-- Enable Row Level Security (RLS) if needed
-- ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Optional: Create a policy for RLS (uncomment if you want to enable RLS)
-- CREATE POLICY "Users can view their own offers" ON public.offers
--     FOR SELECT USING (auth.uid()::text = customer_id);
