import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateUserRequest {
  email: string;
  password: string;
  role: 'admin' | 'user';
  maxProjects: number;
  maxEmployees: number;
}

// Server-side validation
function validateInput(input: CreateUserRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Email validation
  if (!input.email || typeof input.email !== 'string') {
    errors.push('Email é obrigatório');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      errors.push('Email inválido');
    }
    if (input.email.length > 255) {
      errors.push('Email muito longo (máximo 255 caracteres)');
    }
  }

  // Password validation
  if (!input.password || typeof input.password !== 'string') {
    errors.push('Senha é obrigatória');
  } else {
    if (input.password.length < 8) {
      errors.push('Senha deve ter pelo menos 8 caracteres');
    }
    if (input.password.length > 128) {
      errors.push('Senha muito longa (máximo 128 caracteres)');
    }
  }

  // Role validation
  if (!input.role || !['admin', 'user'].includes(input.role)) {
    errors.push('Função inválida (deve ser admin ou user)');
  }

  // Max projects validation
  if (typeof input.maxProjects !== 'number' || input.maxProjects < 1 || input.maxProjects > 100) {
    errors.push('Limite de projetos deve ser entre 1 e 100');
  }

  // Max employees validation
  if (typeof input.maxEmployees !== 'number' || input.maxEmployees < 1 || input.maxEmployees > 10000) {
    errors.push('Limite de funcionários deve ser entre 1 e 10000');
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Get and verify user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify identity
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify user is super admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .single()

    if (roleError || !userRole?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Super admin only.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and validate request body
    const body: CreateUserRequest = await req.json()
    const validation = validateInput(body)
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.errors.join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the user using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      console.error('Error creating user:', authError)
      
      // Handle specific errors
      if (authError.message.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está registrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw authError
    }

    if (!authData.user) {
      throw new Error('Falha ao criar usuário')
    }

    // Add the user role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: body.role,
      })

    if (roleInsertError) {
      console.error('Error inserting role:', roleInsertError)
      // Try to delete the created user to maintain consistency
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw roleInsertError
    }

    // Add user quota
    const { error: quotaError } = await supabaseAdmin
      .from('user_quotas')
      .insert({
        user_id: authData.user.id,
        max_projects: body.maxProjects,
        max_employees: body.maxEmployees,
      })

    if (quotaError) {
      console.error('Error inserting quota:', quotaError)
      // Don't delete user here, role was already created successfully
      // The quota can be added later manually if needed
    }

    // Log the action for audit
    await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'create_user',
        resource_type: 'user',
        resource_id: authData.user.id,
        new_data: {
          email: body.email,
          role: body.role,
          max_projects: body.maxProjects,
          max_employees: body.maxEmployees
        }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: body.role
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
