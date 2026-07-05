// Server-side API route: POST /api/update-usuario
// Uses service_role key to update a user's authentication details (like password) in Supabase.

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);

  if (!body || !body.email || !body.password) {
    return new Response(
      JSON.stringify({ error: 'Faltan campos requeridos: email, password.' }),
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 1. Get user by email to find their ID
    const { data: userData, error: getErr } = await adminClient.auth.admin.listUsers();
    if (getErr) throw getErr;

    const targetUser = userData.users.find(u => u.email?.toLowerCase() === body.email.toLowerCase());
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'No se encontró ningún usuario con ese correo electrónico.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Update their password
    const { error: updErr } = await adminClient.auth.admin.updateUserById(targetUser.id, {
      password: body.password
    });

    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ success: true, message: 'Contraseña actualizada con éxito.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Error al actualizar contraseña.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
