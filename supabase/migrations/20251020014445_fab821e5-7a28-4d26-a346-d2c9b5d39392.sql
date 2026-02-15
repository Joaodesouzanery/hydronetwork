-- Adicionar novas colunas à tabela material_requests
ALTER TABLE material_requests
ADD COLUMN needed_date date,
ADD COLUMN usage_location text,
ADD COLUMN requested_by_employee_id uuid;

-- Criar tabela de funcionários
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  phone text,
  email text,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  construction_site_id uuid REFERENCES construction_sites(id) ON DELETE SET NULL,
  company_name text,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by_user_id uuid NOT NULL
);

-- Enable RLS on employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- RLS policies for employees
CREATE POLICY "Usuários autenticados podem ver funcionários"
ON employees FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar funcionários"
ON employees FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem atualizar funcionários que criaram"
ON employees FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Usuários podem deletar funcionários que criaram"
ON employees FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Adicionar índices para performance
CREATE INDEX idx_employees_project ON employees(project_id);
CREATE INDEX idx_employees_construction_site ON employees(construction_site_id);
CREATE INDEX idx_material_requests_employee ON material_requests(requested_by_employee_id);