-- Remover políticas existentes e recriar com as corretas
DROP POLICY IF EXISTS "Users can view photos from their RDOs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos to their RDOs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- Policy para permitir usuários autenticados visualizarem fotos de seus projetos
CREATE POLICY "Users can view photos from their RDOs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Policy para permitir upload de fotos
CREATE POLICY "Users can upload photos to their RDOs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Policy para permitir deletar fotos
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);