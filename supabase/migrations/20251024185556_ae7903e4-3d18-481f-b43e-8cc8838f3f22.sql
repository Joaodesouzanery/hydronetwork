-- Create function to handle low stock alerts
CREATE OR REPLACE FUNCTION public.check_low_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if quantity is below or equal to minimum stock
  IF NEW.quantity_available <= NEW.minimum_stock THEN
    -- Check if there's an active alert configuration for low stock
    INSERT INTO alertas_historico (alerta_config_id, obra_id, mensagem)
    SELECT 
      ac.id,
      NEW.project_id,
      format('Estoque baixo: %s - Quantidade: %s %s (Mínimo: %s)', 
             NEW.material_name,
             NEW.quantity_available, 
             COALESCE(NEW.unit, ''),
             NEW.minimum_stock)
    FROM alertas_config ac
    WHERE ac.tipo_alerta = 'estoque_baixo'
      AND ac.ativo = true
      AND (ac.obra_id = NEW.project_id OR ac.obra_id IS NULL)
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for inventory low stock check
DROP TRIGGER IF EXISTS trigger_check_low_inventory_stock ON public.inventory;
CREATE TRIGGER trigger_check_low_inventory_stock
  AFTER UPDATE OF quantity_available ON public.inventory
  FOR EACH ROW
  WHEN (OLD.quantity_available <> NEW.quantity_available)
  EXECUTE FUNCTION public.check_low_inventory_stock();

-- Create function to link material requests to inventory when approved
CREATE OR REPLACE FUNCTION public.update_inventory_on_material_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  inventory_record RECORD;
BEGIN
  -- Only process when status changes to 'aprovado'
  IF NEW.status = 'aprovado' AND OLD.status <> 'aprovado' THEN
    -- Try to find matching inventory item
    SELECT * INTO inventory_record
    FROM inventory
    WHERE project_id = NEW.project_id
      AND LOWER(material_name) = LOWER(NEW.material_name)
    LIMIT 1;

    -- If found, create an entry movement
    IF FOUND THEN
      INSERT INTO inventory_movements (
        inventory_id,
        movement_type,
        quantity,
        reason,
        reference_type,
        reference_id,
        created_by_user_id
      ) VALUES (
        inventory_record.id,
        'entrada',
        NEW.quantity,
        format('Pedido aprovado - %s', NEW.requestor_name),
        'material_request',
        NEW.id,
        NEW.requested_by_user_id
      );

      -- Update inventory quantity
      UPDATE inventory
      SET quantity_available = quantity_available + NEW.quantity
      WHERE id = inventory_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for material request approval
DROP TRIGGER IF EXISTS trigger_update_inventory_on_approval ON public.material_requests;
CREATE TRIGGER trigger_update_inventory_on_approval
  AFTER UPDATE OF status ON public.material_requests
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION public.update_inventory_on_material_request_approval();

-- Add index for better performance on material name searches
CREATE INDEX IF NOT EXISTS idx_inventory_material_name_lower ON public.inventory(LOWER(material_name));
CREATE INDEX IF NOT EXISTS idx_material_requests_project_material ON public.material_requests(project_id, LOWER(material_name));