import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration – 24h window, 10 requests max per IP or per QR Code
const RATE_LIMIT_WINDOW_HOURS = 24;
const MAX_REQUESTS_PER_IP = 10;
const MAX_REQUESTS_PER_QR_CODE = 10;
const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

async function checkRateLimits(
  supabase: SupabaseClient,
  clientIp: string,
  qrCodeId: string
): Promise<RateLimitResult> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - RATE_LIMIT_WINDOW_HOURS);

  // Check IP-based rate limit
  const { data: ipRequests, error: ipError } = await supabase
    .from('maintenance_request_rate_limits')
    .select('id')
    .eq('client_ip', clientIp)
    .gte('created_at', cutoffTime.toISOString());

  if (ipError) {
    console.error('Error checking IP rate limit:', ipError);
    return { allowed: false, reason: 'Rate limit check failed' };
  }

  if (ipRequests && ipRequests.length >= MAX_REQUESTS_PER_IP) {
    console.log(`IP rate limit exceeded for ${clientIp}: ${ipRequests.length} requests`);
    return { 
      allowed: false, 
      reason: `Limite de requisições excedido. Tente novamente em ${RATE_LIMIT_WINDOW_HOURS} hora(s).` 
    };
  }

  // Check QR code-based rate limit
  const { data: qrRequests, error: qrError } = await supabase
    .from('maintenance_request_rate_limits')
    .select('id')
    .eq('qr_code_id', qrCodeId)
    .gte('created_at', cutoffTime.toISOString());

  if (qrError) {
    console.error('Error checking QR code rate limit:', qrError);
    return { allowed: false, reason: 'Rate limit check failed' };
  }

  if (qrRequests && qrRequests.length >= MAX_REQUESTS_PER_QR_CODE) {
    console.log(`QR code rate limit exceeded for ${qrCodeId}: ${qrRequests.length} requests`);
    return { 
      allowed: false, 
      reason: `Este QR Code atingiu o limite de solicitações. Tente novamente em ${RATE_LIMIT_WINDOW_HOURS} hora(s).` 
    };
  }

  return { allowed: true };
}

async function recordRateLimitEntry(
  supabase: SupabaseClient,
  clientIp: string,
  qrCodeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('maintenance_request_rate_limits')
    .insert({
      client_ip: clientIp,
      qr_code_id: qrCodeId
    });

  if (error) {
    console.error('Error recording rate limit entry:', error);
    return false;
  }
  return true;
}

async function validateQrCode(
  supabase: SupabaseClient,
  qrCodeId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('maintenance_qr_codes')
    .select('id, is_active')
    .eq('id', qrCodeId)
    .single();

  if (error || !data) {
    console.log('QR code not found:', qrCodeId);
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(data as any).is_active) {
    console.log('QR code is inactive:', qrCodeId);
    return false;
  }

  return true;
}

async function generateSignedUploadUrl(
  supabase: SupabaseClient,
  fileName: string
): Promise<string | null> {
  const filePath = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  
  const { data, error } = await supabase.storage
    .from('maintenance-request-photos')
    .createSignedUploadUrl(filePath);

  if (error) {
    console.error('Error creating signed upload URL:', error);
    return null;
  }

  return data.signedUrl;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP from headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';

    console.log(`Maintenance request from IP: ${clientIp}`);

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, qr_code_id, file_name, maintenance_request } = body;

      if (!qr_code_id) {
        return new Response(
          JSON.stringify({ error: 'QR Code ID é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate QR code exists and is active
      const isValidQrCode = await validateQrCode(supabase, qr_code_id);
      if (!isValidQrCode) {
        return new Response(
          JSON.stringify({ error: 'QR Code inválido ou inativo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check rate limits
      const rateLimitResult = await checkRateLimits(supabase, clientIp, qr_code_id);
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({ error: rateLimitResult.reason }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle different actions
      if (action === 'get_upload_url') {
        // Generate signed URL for photo upload
        if (!file_name) {
          return new Response(
            JSON.stringify({ error: 'Nome do arquivo é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const signedUrl = await generateSignedUploadUrl(supabase, file_name);
        if (!signedUrl) {
          return new Response(
            JSON.stringify({ error: 'Falha ao gerar URL de upload' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            signed_url: signedUrl,
            expires_in: SIGNED_URL_EXPIRY_SECONDS
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'create_request') {
        // Validate maintenance request data
        if (!maintenance_request) {
          return new Response(
            JSON.stringify({ error: 'Dados da solicitação são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { requester_name, issue_description, urgency_level, photos_urls } = maintenance_request;

        if (!requester_name || !issue_description) {
          return new Response(
            JSON.stringify({ error: 'Nome do solicitante e descrição do problema são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Sanitize input - prevent XSS
        const sanitizedName = requester_name.substring(0, 200).replace(/<[^>]*>/g, '');
        const sanitizedDescription = issue_description.substring(0, 2000).replace(/<[^>]*>/g, '');
        const sanitizedUrgency = ['baixa', 'media', 'alta'].includes(urgency_level) 
          ? urgency_level 
          : 'media';

        // Create the maintenance request
        const { data: newRequest, error: insertError } = await supabase
          .from('maintenance_requests')
          .insert({
            qr_code_id,
            requester_name: sanitizedName,
            issue_description: sanitizedDescription,
            urgency_level: sanitizedUrgency,
            photos_urls: photos_urls || [],
            status: 'pending'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating maintenance request:', insertError);
          return new Response(
            JSON.stringify({ error: 'Falha ao criar solicitação de manutenção' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Record rate limit entry after successful request creation
        await recordRateLimitEntry(supabase, clientIp, qr_code_id);

        console.log(`Maintenance request created successfully: ${(newRequest as any).id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Solicitação de manutenção criada com sucesso',
            request_id: (newRequest as any).id
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Ação inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in maintenance-request-upload:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
