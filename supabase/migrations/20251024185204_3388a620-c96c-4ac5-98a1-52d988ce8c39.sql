-- Allow project_id to be nullable in inventory table
ALTER TABLE public.inventory 
ALTER COLUMN project_id DROP NOT NULL;