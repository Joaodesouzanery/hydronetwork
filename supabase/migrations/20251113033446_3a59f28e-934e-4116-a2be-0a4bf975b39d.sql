-- Create materials table for budget module
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  color TEXT,
  measurement TEXT,
  unit TEXT NOT NULL,
  current_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(10,2) DEFAULT 0,
  current_stock NUMERIC(10,2) DEFAULT 0,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Create price history table
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  changed_by_user_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT
);

-- Create custom keywords table
CREATE TABLE IF NOT EXISTS public.custom_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  keyword_type TEXT NOT NULL, -- 'brand', 'color', 'unit', 'general'
  keyword_value TEXT NOT NULL,
  UNIQUE(created_by_user_id, keyword_type, keyword_value)
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  budget_number TEXT,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_contact TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'approved', 'rejected'
  valid_until DATE,
  payment_terms TEXT,
  notes TEXT,
  total_material NUMERIC(10,2) DEFAULT 0,
  total_labor NUMERIC(10,2) DEFAULT 0,
  total_bdi NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0
);

-- Create budget items table
CREATE TABLE IF NOT EXISTS public.budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price_material NUMERIC(10,2) DEFAULT 0,
  unit_price_labor NUMERIC(10,2) DEFAULT 0,
  bdi_percentage NUMERIC(5,2) DEFAULT 0,
  subtotal_material NUMERIC(10,2) DEFAULT 0,
  subtotal_labor NUMERIC(10,2) DEFAULT 0,
  subtotal_bdi NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  price_at_creation NUMERIC(10,2), -- Historical price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for materials
CREATE POLICY "Users can view their own materials"
  ON public.materials FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create materials"
  ON public.materials FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own materials"
  ON public.materials FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own materials"
  ON public.materials FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for price_history
CREATE POLICY "Users can view price history of their materials"
  ON public.price_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = price_history.material_id
    AND m.created_by_user_id = auth.uid()
  ));

CREATE POLICY "System can insert price history"
  ON public.price_history FOR INSERT
  WITH CHECK (auth.uid() = changed_by_user_id);

-- RLS Policies for custom_keywords
CREATE POLICY "Users can view their own keywords"
  ON public.custom_keywords FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create keywords"
  ON public.custom_keywords FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own keywords"
  ON public.custom_keywords FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own keywords"
  ON public.custom_keywords FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for budgets
CREATE POLICY "Users can view their own budgets"
  ON public.budgets FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own budgets"
  ON public.budgets FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own budgets"
  ON public.budgets FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for budget_items
CREATE POLICY "Users can view items from their budgets"
  ON public.budget_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create budget items"
  ON public.budget_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can update items from their budgets"
  ON public.budget_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their budgets"
  ON public.budget_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

-- Trigger to update materials updated_at
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update budgets updated_at
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to track price changes
CREATE OR REPLACE FUNCTION public.track_material_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_price IS DISTINCT FROM NEW.current_price THEN
    INSERT INTO public.price_history (
      material_id,
      old_price,
      new_price,
      changed_by_user_id
    ) VALUES (
      NEW.id,
      OLD.current_price,
      NEW.current_price,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically track price changes
CREATE TRIGGER track_material_price_changes
  AFTER UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.track_material_price_change();

-- Function to recalculate budget totals
CREATE OR REPLACE FUNCTION public.recalculate_budget_totals()
RETURNS TRIGGER AS $$
DECLARE
  budget_totals RECORD;
BEGIN
  -- Calculate totals from budget items
  SELECT
    COALESCE(SUM(subtotal_material), 0) as total_mat,
    COALESCE(SUM(subtotal_labor), 0) as total_lab,
    COALESCE(SUM(subtotal_bdi), 0) as total_bdi_val,
    COALESCE(SUM(total), 0) as total_amt
  INTO budget_totals
  FROM public.budget_items
  WHERE budget_id = COALESCE(NEW.budget_id, OLD.budget_id);

  -- Update budget totals
  UPDATE public.budgets
  SET
    total_material = budget_totals.total_mat,
    total_labor = budget_totals.total_lab,
    total_bdi = budget_totals.total_bdi_val,
    total_amount = budget_totals.total_amt,
    updated_at = now()
  WHERE id = COALESCE(NEW.budget_id, OLD.budget_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to recalculate budget totals when items change
CREATE TRIGGER recalculate_budget_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_budget_totals();

-- Function to auto-generate budget number
CREATE OR REPLACE FUNCTION public.generate_budget_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_number IS NULL OR NEW.budget_number = '' THEN
    NEW.budget_number := 'ORC-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('budget_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create sequence for budget numbers
CREATE SEQUENCE IF NOT EXISTS public.budget_number_seq START 1;

-- Trigger to auto-generate budget number
CREATE TRIGGER generate_budget_number_trigger
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_budget_number();