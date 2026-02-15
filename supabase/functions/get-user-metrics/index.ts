import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user token
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Verify user is authenticated and is super admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is super admin
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

    // Get all users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    if (authError) {
      throw authError
    }

    // Get user roles
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')

    const userMetrics = []
    let totalProjects = 0
    let totalEmployees = 0
    let totalMaterials = 0

    for (const authUser of authUsers.users) {
      const role = userRoles?.find(r => r.user_id === authUser.id)?.role || 'user'

      // Count projects
      const { count: projectsCount } = await supabaseAdmin
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_user_id', authUser.id)

      // Count employees
      const { count: employeesCount } = await supabaseAdmin
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_user_id', authUser.id)

      // Count materials
      const { count: materialsCount } = await supabaseAdmin
        .from('materials')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_user_id', authUser.id)

      // Count RDOs
      const { count: rdosCount } = await supabaseAdmin
        .from('daily_reports')
        .select('*', { count: 'exact', head: true })
        .eq('executed_by_user_id', authUser.id)

      // Count material requests
      const { count: materialRequestsCount } = await supabaseAdmin
        .from('material_requests')
        .select('*', { count: 'exact', head: true })
        .eq('requested_by_user_id', authUser.id)

      // Get last activity
      const { data: lastProject } = await supabaseAdmin
        .from('projects')
        .select('updated_at')
        .eq('created_by_user_id', authUser.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      totalProjects += projectsCount || 0
      totalEmployees += employeesCount || 0
      totalMaterials += materialsCount || 0

      userMetrics.push({
        user_id: authUser.id,
        email: authUser.email || '',
        role,
        created_at: authUser.created_at,
        total_projects: projectsCount || 0,
        total_employees: employeesCount || 0,
        total_materials: materialsCount || 0,
        total_rdos: rdosCount || 0,
        total_material_requests: materialRequestsCount || 0,
        last_activity: lastProject?.updated_at || null,
      })
    }

    return new Response(
      JSON.stringify({
        metrics: userMetrics,
        totals: {
          totalUsers: authUsers.users.length,
          totalProjects,
          totalEmployees,
          totalMaterials,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
