-- ============================================================
-- Vigia - Fix Crítico: auth.create_user, columnas faltantes, RLS soporte
-- ============================================================

-- 0. Asegurarse de que pgcrypto esté disponible
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Re-crear auth.create_user usando crypt/gen_salt de pgcrypto en public (sin prefix extensions.)
--    Esta versión es más portable en Supabase cloud donde 'extensions' schema puede variar.
CREATE OR REPLACE FUNCTION auth.create_user(p_params jsonb)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
LANGUAGE plpgsql AS $$
DECLARE
  v_email TEXT;
  v_password TEXT;
  v_confirm BOOLEAN;
  v_user_metadata JSONB;
  v_new_user_id UUID;
BEGIN
  v_email := p_params->>'email';
  v_password := p_params->>'password';
  v_confirm := COALESCE((p_params->>'email_confirm')::BOOLEAN, false);
  v_user_metadata := COALESCE((p_params->'user_metadata'), '{}'::jsonb);

  v_new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new,
    email_change_token_current, recovery_token, phone_change_token, reauthentication_token
  )
  VALUES (
    v_new_user_id,
    v_email,
    crypt(v_password, gen_salt('bf', 10)),
    CASE WHEN v_confirm THEN NOW() ELSE NULL END,
    v_user_metadata,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    NOW(), NOW(),
    '', '', '', '', '', '', ''
  );

  RETURN v_new_user_id;
END;
$$;

-- 2. Re-crear crear_usuario_admin con search_path que incluye public (donde pgcrypto instala crypt/gen_salt)
CREATE OR REPLACE FUNCTION public.crear_usuario_admin(
  p_email TEXT,
  p_password TEXT,
  p_institucion_id UUID,
  p_nombre_completo TEXT,
  p_rol TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_rol TEXT;
  v_caller_inst_id UUID;
  v_new_user_id UUID;
BEGIN
  -- Obtener rol e institución del invocador
  SELECT rol, institucion_id INTO v_caller_rol, v_caller_inst_id
  FROM public.usuarios WHERE id = auth.uid();

  -- Validar permisos
  IF v_caller_rol != 'superadmin' AND (v_caller_rol != 'admin_institucion' OR v_caller_inst_id != p_institucion_id) THEN
    RAISE EXCEPTION 'No tienes permisos para crear usuarios en esta institución.';
  END IF;

  v_new_user_id := gen_random_uuid();

  -- Insertar en auth.users usando crypt/gen_salt de pgcrypto
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new,
    email_change_token_current, recovery_token, phone_change_token, reauthentication_token
  )
  VALUES (
    v_new_user_id,
    p_email,
    crypt(p_password, gen_salt('bf', 10)),
    NOW(),
    jsonb_build_object(
      'institucion_id', p_institucion_id,
      'nombre_completo', p_nombre_completo,
      'rol', p_rol
    ),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    NOW(), NOW(),
    '', '', '', '', '', '', ''
  );

  -- Insertar en public.usuarios (tabla de perfil)
  INSERT INTO public.usuarios (id, institucion_id, nombre_completo, email, rol)
  VALUES (v_new_user_id, p_institucion_id, p_nombre_completo, p_email, p_rol)
  ON CONFLICT (id) DO NOTHING;

  RETURN v_new_user_id;
END;
$$;

-- 3. Agregar columnas de Habeas Data si no existen (idempotente)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS acepta_datos_ley BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_aceptacion_ley TIMESTAMPTZ;

ALTER TABLE public.instituciones
  ADD COLUMN IF NOT EXISTS acepta_datos_ley BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_aceptacion_ley TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS en_demo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS inicio_demo DATE,
  ADD COLUMN IF NOT EXISTS limite_demo DATE,
  ADD COLUMN IF NOT EXISTS tiene_capacitacion BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS horas_capacitacion INTEGER DEFAULT 0;

ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT false;

-- 4. Hacer remitente_id opcional en soporte_mensajes para el superadmin
--    (que puede no tener registro en public.usuarios)
ALTER TABLE public.soporte_mensajes
  ALTER COLUMN remitente_id DROP NOT NULL;

-- 5. Actualizar política RLS de soporte_mensajes: superadmin ve y escribe en todos los tickets
DROP POLICY IF EXISTS "soporte_mensajes_ver" ON public.soporte_mensajes;
CREATE POLICY "soporte_mensajes_ver" ON public.soporte_mensajes FOR SELECT
  USING (
    public.usuario_rol() = 'superadmin'
    OR ticket_id IN (
      SELECT id FROM public.soporte_tickets
      WHERE institucion_id = public.usuario_institucion_id()
    )
  );

DROP POLICY IF EXISTS "soporte_mensajes_insert" ON public.soporte_mensajes;
CREATE POLICY "soporte_mensajes_insert" ON public.soporte_mensajes FOR INSERT
  WITH CHECK (
    public.usuario_rol() = 'superadmin'
    OR ticket_id IN (
      SELECT id FROM public.soporte_tickets
      WHERE institucion_id = public.usuario_institucion_id()
    )
  );

-- 6. Habilitar realtime en tablas de soporte
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.soporte_mensajes;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.soporte_tickets;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
