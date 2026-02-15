-- 1. Corrigir política de maintenance_requests para exigir autenticação na criação
DROP POLICY IF EXISTS "Anyone can create maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Authenticated users can create maintenance requests"
ON public.maintenance_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Adicionar política explícita de negação de DELETE em inventory_movements
DROP POLICY IF EXISTS "Prevent deletion of inventory movements" ON public.inventory_movements;
CREATE POLICY "Prevent deletion of inventory movements"
ON public.inventory_movements
FOR DELETE
TO authenticated
USING (false);

-- 3. Adicionar política explícita de negação de UPDATE em inventory_movements
DROP POLICY IF EXISTS "Prevent update of inventory movements" ON public.inventory_movements;
CREATE POLICY "Prevent update of inventory movements"
ON public.inventory_movements
FOR UPDATE
TO authenticated
USING (false);

-- 4. Adicionar política explícita de negação de DELETE em price_history
DROP POLICY IF EXISTS "Prevent deletion of price history" ON public.price_history;
CREATE POLICY "Prevent deletion of price history"
ON public.price_history
FOR DELETE
TO authenticated
USING (false);

-- 5. Adicionar política explícita de negação de UPDATE em price_history
DROP POLICY IF EXISTS "Prevent update of price history" ON public.price_history;
CREATE POLICY "Prevent update of price history"
ON public.price_history
FOR UPDATE
TO authenticated
USING (false);

-- 6. Habilitar proteção de senhas vazadas via configuração de auth (feito separadamente)
