// Allowed origins for CORS — restrict to production domain(s)
const ALLOWED_ORIGINS = [
  'https://construdata.com.br',
  'https://www.construdata.com.br',
  'https://hydronetwork.vercel.app',
  'http://localhost:5173',   // local dev
  'http://localhost:8080',   // local dev alt
];

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Backwards-compatible export — prefer getCorsHeaders(req) for origin checking
export const corsHeaders = getCorsHeaders();
