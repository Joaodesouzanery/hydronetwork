-- Add synonyms column to custom_keywords table
ALTER TABLE custom_keywords 
ADD COLUMN synonyms text[] DEFAULT ARRAY[]::text[];