-- Skapa documents tabellen
CREATE TABLE public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  valid_from DATE,
  valid_to DATE,
  checksum TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lägg till index för bättre prestanda
CREATE INDEX idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX idx_documents_doc_type ON public.documents(doc_type);
CREATE INDEX idx_documents_created_at ON public.documents(created_at);

-- Aktivera RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy - användare kan bara se dokument från sina tenants
CREATE POLICY "Users can view documents from their tenants" ON public.documents
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy - användare kan bara skapa dokument i sina tenants
CREATE POLICY "Users can create documents in their tenants" ON public.documents
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy - användare kan bara uppdatera dokument i sina tenants
CREATE POLICY "Users can update documents in their tenants" ON public.documents
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy - användare kan bara ta bort dokument från sina tenants
CREATE POLICY "Users can delete documents from their tenants" ON public.documents
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users 
      WHERE user_id = auth.uid()
    )
  );
