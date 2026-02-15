-- =============================================
-- ADD NORMALIZED FIELDS FOR KEYWORD-BASED MATCHING
-- =============================================

-- Add normalized keywords array (tokenized, lowercase, no accents)
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS keywords_norm text[] DEFAULT '{}';

-- Add normalized description (lowercase, no accents, cleaned)
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS description_norm text DEFAULT '';

-- Create index for keyword matching using GIN
CREATE INDEX IF NOT EXISTS idx_materials_keywords_norm 
ON public.materials USING GIN(keywords_norm);

-- Create index for description search
CREATE INDEX IF NOT EXISTS idx_materials_description_norm 
ON public.materials USING btree(description_norm);

-- =============================================
-- FUNCTION: Normalize text for matching
-- =============================================
CREATE OR REPLACE FUNCTION public.normalize_text_for_matching(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        translate(
          input_text,
          'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
          'AAAAAAACEEEEIIIIDNOOOOOOUUUUYTsaaaaaaaceeeeiiiidnoooooouuuuyty'
        ),
        '[^\w\s]', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$;

-- =============================================
-- FUNCTION: Tokenize text into keywords array
-- =============================================
CREATE OR REPLACE FUNCTION public.tokenize_keywords(input_text text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
  tokens text[];
  result text[];
  token text;
BEGIN
  normalized := public.normalize_text_for_matching(input_text);
  -- Split by space, comma, pipe, semicolon
  tokens := regexp_split_to_array(normalized, '[\s,|;]+');
  
  result := '{}';
  FOREACH token IN ARRAY tokens
  LOOP
    -- Only include tokens with length > 2 and not already in result
    IF length(token) > 2 AND NOT (token = ANY(result)) THEN
      result := array_append(result, token);
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;

-- =============================================
-- TRIGGER: Auto-update normalized fields on insert/update
-- =============================================
CREATE OR REPLACE FUNCTION public.update_materials_normalized_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Update keywords_norm from name and existing keywords
  NEW.keywords_norm := (
    SELECT ARRAY(
      SELECT DISTINCT unnest
      FROM unnest(
        public.tokenize_keywords(NEW.name) || 
        COALESCE(
          (SELECT array_agg(public.normalize_text_for_matching(k)) 
           FROM unnest(NEW.keywords) AS k 
           WHERE k IS NOT NULL AND k != ''),
          '{}'::text[]
        )
      )
      WHERE unnest IS NOT NULL AND unnest != ''
    )
  );
  
  -- Update description_norm
  NEW.description_norm := public.normalize_text_for_matching(
    COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, '')
  );
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_materials_normalized ON public.materials;

-- Create trigger
CREATE TRIGGER trigger_update_materials_normalized
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_materials_normalized_fields();

-- =============================================
-- BACKFILL: Update existing materials with normalized fields
-- =============================================
UPDATE public.materials SET
  keywords_norm = (
    SELECT ARRAY(
      SELECT DISTINCT unnest
      FROM unnest(
        public.tokenize_keywords(name) || 
        COALESCE(
          (SELECT array_agg(public.normalize_text_for_matching(k)) 
           FROM unnest(keywords) AS k 
           WHERE k IS NOT NULL AND k != ''),
          '{}'::text[]
        )
      )
      WHERE unnest IS NOT NULL AND unnest != ''
    )
  ),
  description_norm = public.normalize_text_for_matching(
    COALESCE(name, '') || ' ' || COALESCE(description, '')
  )
WHERE keywords_norm = '{}' OR keywords_norm IS NULL OR description_norm = '' OR description_norm IS NULL;