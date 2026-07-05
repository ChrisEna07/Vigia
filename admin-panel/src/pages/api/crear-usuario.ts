// Server-side API route: POST /api/crear-usuario
// Uses service_role key (server-only, never exposed to browser) to call
// supabase.auth.admin.createUser() - the correct way to create users in Supabase.

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);

  if (!body || !body.email || !body.password || !body.institucion_id || !body.nombre_completo || !body.rol) {
    return new Response(
      JSON.stringify({ error: 'Faltan campos requeridos: email, password, institucion_id, nombre_completo, rol.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Admin client – uses service_role, bypasses RLS, runs only server-side
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 1. Create auth user via Admin API (no SQL functions needed)
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        rol: body.rol,
        institucion_id: body.institucion_id,
        nombre_completo: body.nombre_completo,
      },
    });

    if (authErr) throw authErr;
    const newUserId = authData.user.id;

    // 2. Upsert profile row in public.usuarios
    const { error: profileErr } = await adminClient
      .from('usuarios')
      .upsert({
        id: newUserId,
        institucion_id: body.institucion_id,
        nombre_completo: body.nombre_completo,
        email: body.email,
        rol: body.rol,
        activo: true,
      }, { onConflict: 'id' });

    if (profileErr) {
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(newUserId);
      throw profileErr;
    }

    return new Response(
      JSON.stringify({ id: newUserId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Error al crear usuario.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
