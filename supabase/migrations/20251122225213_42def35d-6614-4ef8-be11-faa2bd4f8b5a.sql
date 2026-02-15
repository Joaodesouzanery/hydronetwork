-- Add new fields to connection_reports table
ALTER TABLE public.connection_reports 
ADD COLUMN IF NOT EXISTS service_category TEXT CHECK (service_category IN ('agua', 'esgoto')),
ADD COLUMN IF NOT EXISTS connection_type TEXT CHECK (connection_type IN ('avulsa', 'intra_1', 'intra_2'));