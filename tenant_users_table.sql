-- Skapa tenant_users tabellen
CREATE TABLE public.tenant_users (
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Lägg till index för bättre prestanda
CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);

-- Aktivera RLS
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy - användare kan bara se sina egna tenant-relationer
CREATE POLICY "Users can view own tenant relations" ON public.tenant_users
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy - användare kan bara uppdatera sina egna tenant-relationer
CREATE POLICY "Users can update own tenant relations" ON public.tenant_users
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policy - användare kan bara ta bort sina egna tenant-relationer
CREATE POLICY "Users can delete own tenant relations" ON public.tenant_users
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policy - användare kan bara lägga till sig själva till tenants
CREATE POLICY "Users can insert own tenant relations" ON public.tenant_users
  FOR INSERT WITH CHECK (auth.uid() = user_id);
