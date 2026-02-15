-- Adicionar campos climáticos à tabela daily_reports
ALTER TABLE public.daily_reports 
ADD COLUMN IF NOT EXISTS temperature NUMERIC,
ADD COLUMN IF NOT EXISTS humidity INTEGER,
ADD COLUMN IF NOT EXISTS wind_speed NUMERIC,
ADD COLUMN IF NOT EXISTS will_rain BOOLEAN,
ADD COLUMN IF NOT EXISTS weather_description TEXT,
ADD COLUMN IF NOT EXISTS terrain_condition TEXT,
ADD COLUMN IF NOT EXISTS gps_location TEXT,
ADD COLUMN IF NOT EXISTS general_observations TEXT;