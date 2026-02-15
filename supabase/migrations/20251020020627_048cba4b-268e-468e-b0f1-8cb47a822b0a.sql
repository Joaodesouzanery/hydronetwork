-- Adicionar campo department (setor) na tabela employees
ALTER TABLE public.employees ADD COLUMN department text;

-- Criar índice para melhorar performance nas consultas por setor
CREATE INDEX idx_employees_department ON public.employees(department);