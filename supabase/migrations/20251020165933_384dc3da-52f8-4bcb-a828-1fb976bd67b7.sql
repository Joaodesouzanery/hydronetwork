-- Adicionar coluna requestor_name à tabela material_requests
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS requestor_name TEXT;