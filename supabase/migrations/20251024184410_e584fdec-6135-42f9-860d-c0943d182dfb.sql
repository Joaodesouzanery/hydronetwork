-- Create inventory (almoxarifado) table
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  material_name TEXT NOT NULL,
  material_code TEXT,
  category TEXT,
  unit TEXT,
  quantity_available NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC DEFAULT 0,
  location TEXT,
  supplier TEXT,
  unit_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view inventory from their projects"
  ON public.inventory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = inventory.project_id
      AND projects.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory items"
  ON public.inventory
  FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update inventory items they created"
  ON public.inventory
  FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete inventory items they created"
  ON public.inventory
  FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_inventory_project_id ON public.inventory(project_id);
CREATE INDEX idx_inventory_material_name ON public.inventory(material_name);
CREATE INDEX idx_inventory_category ON public.inventory(category);

-- Create inventory movements table for tracking stock changes
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'transferencia')),
  quantity NUMERIC NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for movements
CREATE POLICY "Users can view movements from their inventory"
  ON public.inventory_movements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventory i
      JOIN projects p ON p.id = i.project_id
      WHERE i.id = inventory_movements.inventory_id
      AND p.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory movements"
  ON public.inventory_movements
  FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

-- Create index for movements
CREATE INDEX idx_inventory_movements_inventory_id ON public.inventory_movements(inventory_id);
CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);