-- Add materials_used column to connection_reports table
ALTER TABLE connection_reports
ADD COLUMN materials_used JSONB DEFAULT '[]'::jsonb;