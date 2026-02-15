-- Create consumption readings table
CREATE TABLE public.consumption_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reading_time TEXT NOT NULL CHECK (reading_time IN ('08:00', '14:00', '18:00', '20:00')),
  meter_value NUMERIC NOT NULL,
  meter_type TEXT NOT NULL DEFAULT 'water',
  location TEXT,
  notes TEXT,
  recorded_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, reading_date, reading_time, meter_type, location)
);

-- Enable RLS
ALTER TABLE public.consumption_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view readings from their projects"
ON public.consumption_readings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = consumption_readings.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create readings"
ON public.consumption_readings FOR INSERT
WITH CHECK (auth.uid() = recorded_by_user_id);

CREATE POLICY "Users can update readings they created"
ON public.consumption_readings FOR UPDATE
USING (auth.uid() = recorded_by_user_id);

CREATE POLICY "Users can delete readings they created"
ON public.consumption_readings FOR DELETE
USING (auth.uid() = recorded_by_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_consumption_readings_updated_at
BEFORE UPDATE ON public.consumption_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();