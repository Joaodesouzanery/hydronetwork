-- Fix search_path for the new functions
ALTER FUNCTION public.normalize_text_for_matching(text) SET search_path = public;
ALTER FUNCTION public.tokenize_keywords(text) SET search_path = public;