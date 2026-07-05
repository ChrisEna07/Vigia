import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros de configuración para el wipe.' }),
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

    // Initialize admin client (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { wipeTodo, wipeAccesos, wipeNovedades, wipeChats, wipeAutorizaciones, wipeClientes } = body;

    if (wipeTodo) {
      // 1. Transactional data delete
      const tables = [
        'bitacora_accesos',
        'turnos',
        'novedades',
        'mensajes',
        'soporte_mensajes',
        'soporte_tickets',
        'autorizaciones_salida'
      ];
      for (const table of tables) {
        const { error } = await adminClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
          return new Response(
            JSON.stringify({ error: `Error limpiando ${table}: ${error.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // 2. Delete all Auth Users except chrizdev07@gmail.com
      const { data: usersData, error: usersErr } = await adminClient.auth.admin.listUsers({
        limit: 1000
      });
      if (usersErr) {
        return new Response(
          JSON.stringify({ error: `Error listando usuarios de autenticación: ${usersErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      for (const u of usersData.users) {
        if (u.email && u.email !== 'chrizdev07@gmail.com') {
          const { error } = await adminClient.auth.admin.deleteUser(u.id);
          if (error) {
            return new Response(
              JSON.stringify({ error: `Error eliminando usuario ${u.email}: ${error.message}` }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // 3. Delete institutions except demo
      const { error: instErr } = await adminClient.from('instituciones').delete().neq('slug', 'demo');
      if (instErr) {
        return new Response(
          JSON.stringify({ error: `Error limpiando instituciones: ${instErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: '¡Wipe total completado con éxito! La base de datos está limpia.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Selective wipe
    if (wipeAccesos) {
      // bitacora_accesos will delete vehiculos_acceso and equipos_acceso via CASCADE
      const { error } = await adminClient.from('bitacora_accesos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        return new Response(
          JSON.stringify({ error: `Error limpiando bitácora de accesos: ${error.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (wipeNovedades) {
      // First delete novedades then turnos
      const { error: novErr } = await adminClient.from('novedades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (novErr) {
        return new Response(
          JSON.stringify({ error: `Error limpiando novedades: ${novErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { error: turnErr } = await adminClient.from('turnos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (turnErr) {
        return new Response(
          JSON.stringify({ error: `Error limpiando turnos: ${turnErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (wipeChats) {
      const { error: chatErr } = await adminClient.from('mensajes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (chatErr) {
        return new Response(
          JSON.stringify({ error: `Error limpiando mensajes: ${chatErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const { error: ticketErr } = await adminClient.from('soporte_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (ticketErr) {
        return new Response(
          JSON.stringify({ error: `Error limpiando soporte: ${ticketErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (wipeAutorizaciones) {
      const { error } = await adminClient.from('autorizaciones_salida').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        return new Response(
          JSON.stringify({ error: `Error limpiando autorizaciones: ${error.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (wipeClientes) {
      // First delete auth users
      const { data: usersData, error: usersErr } = await adminClient.auth.admin.listUsers({ limit: 1000 });
      if (usersErr) {
        return new Response(
          JSON.stringify({ error: `Error listando usuarios para borrar clientes: ${usersErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      for (const u of usersData.users) {
        if (u.email && u.email !== 'chrizdev07@gmail.com') {
          const { error } = await adminClient.auth.admin.deleteUser(u.id);
          if (error) {
            return new Response(
              JSON.stringify({ error: `Error eliminando usuario ${u.email}: ${error.message}` }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      const { error: instErr } = await adminClient.from('instituciones').delete().neq('slug', 'demo');
      if (instErr) {
        return new Response(
          JSON.stringify({ error: `Error limpiando instituciones: ${instErr.message}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: '¡Wipe selectivo por secciones completado con éxito!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || err }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
