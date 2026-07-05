-- ============================================================
-- Vigia - Wipe de Mantenimiento para Producción
-- ============================================================

CREATE OR REPLACE FUNCTION public.wipe_produccion_total()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
AS $$
BEGIN
  -- 1. Eliminar datos transaccionales de todas las bitácoras e historiales
  DELETE FROM public.bitacora_accesos;
  DELETE FROM public.turnos;
  DELETE FROM public.novedades;
  DELETE FROM public.mensajes;
  DELETE FROM public.soporte_mensajes;
  DELETE FROM public.soporte_tickets;
  DELETE FROM public.autorizaciones_salida;

  -- 2. Eliminar usuarios de autenticación de Supabase (GoTrue) excepto el Super Admin
  DELETE FROM auth.users WHERE email != 'chrizdev07@gmail.com';

  -- 3. Eliminar clientes (instituciones) excepto la de demostración inicial 'demo'
  DELETE FROM public.instituciones WHERE slug != 'demo';
END;
$$;
