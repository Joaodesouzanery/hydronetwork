-- Add foreign key constraints to material_requests
ALTER TABLE public.material_requests
ADD CONSTRAINT material_requests_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.material_requests
ADD CONSTRAINT material_requests_service_front_id_fkey 
FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE CASCADE;

-- Add foreign key constraints to material_control
ALTER TABLE public.material_control
ADD CONSTRAINT material_control_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.material_control
ADD CONSTRAINT material_control_service_front_id_fkey 
FOREIGN KEY (service_front_id) REFERENCES public.service_fronts(id) ON DELETE CASCADE;