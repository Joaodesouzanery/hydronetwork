-- Adicionar campo employee_id à tabela production_targets
ALTER TABLE public.production_targets 
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);