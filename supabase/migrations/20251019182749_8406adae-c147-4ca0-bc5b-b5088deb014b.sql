-- Force TypeScript types regeneration by adding a comment to an existing table
COMMENT ON TABLE public.obras IS 'Tabela principal para gerenciamento de obras de construção';

-- Refresh the schema to ensure types are regenerated
SELECT 1;