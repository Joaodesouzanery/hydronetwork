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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Backwards-compatible export for existing edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
