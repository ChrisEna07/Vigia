-- ============================================================
-- Vigia - Fix RLS, Funciones Auth, Tabla de Auditoría, Realtime y Demos
-- ============================================================

-- 0. Crear la función auxiliar auth.create_user si no existe para compatibilidad con seed.sql y RPCs antiguos
CREATE OR REPLACE FUNCTION auth.create_user(p_params jsonb)
RETURNS UUID
SECURITY DEFINER
SET search_path = auth, pg_catalog, extensions
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
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, email_change_token_current, recovery_token, phone_change_token, reauthentication_token
  )
  VALUES (
    v_new_user_id,
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
    CASE WHEN v_confirm THEN NOW() ELSE NULL END,
    v_user_metadata,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    NOW(),
    NOW(),
    '', '', '', '', '', '', ''
  );
  
  RETURN v_new_user_id;
END;
$$;

-- 1. Actualizar políticas RLS de modulos_config
DROP POLICY IF EXISTS "admin_gestiona_modulos" ON public.modulos_config;
CREATE POLICY "admin_gestiona_modulos"
  ON public.modulos_config FOR INSERT
  WITH CHECK (
    (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin')
    AND public.usuario_rol() IN ('superadmin', 'admin_institucion')
  );

DROP POLICY IF EXISTS "admin_update_modulos" ON public.modulos_config;
CREATE POLICY "admin_update_modulos"
  ON public.modulos_config FOR UPDATE
  USING (
    institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin'
  );

-- 2. Redefinir la función crear_usuario_admin usando inserción directa con crypt/gen_salt calificados en extensions
CREATE OR REPLACE FUNCTION public.crear_usuario_admin(
  p_email TEXT,
  p_password TEXT,
  p_institucion_id UUID,
  p_nombre_completo TEXT,
  p_rol TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_catalog, auth, extensions
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_rol TEXT;
  v_caller_inst_id UUID;
  v_new_user_id UUID;
BEGIN
  -- Obtener rol e institucion del invocador
  SELECT rol, institucion_id INTO v_caller_rol, v_caller_inst_id 
  FROM public.usuarios WHERE id = auth.uid();

  -- Validar permisos (permitir a superadmin o a admin_institucion de la misma institucion)
  IF v_caller_rol != 'superadmin' AND (v_caller_rol != 'admin_institucion' OR v_caller_inst_id != p_institucion_id) THEN
    RAISE EXCEPTION 'No tienes permisos para crear usuarios en esta institución.';
  END IF;

  -- Generar UUID para el nuevo usuario
  v_new_user_id := gen_random_uuid();

  -- Insertar en auth.users
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, email_change_token_current, recovery_token, phone_change_token, reauthentication_token
  )
  VALUES (
    v_new_user_id,
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    NOW(),
    jsonb_build_object(
      'institucion_id', p_institucion_id,
      'nombre_completo', p_nombre_completo,
      'rol', p_rol
    ),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    NOW(),
    NOW(),
    '', '', '', '', '', '', ''
  );

  RETURN v_new_user_id;
END;
$$;

-- 3. Crear tabla de logs de auditoría para clientes/admin locales
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  actor_nombre    TEXT NOT NULL,
  actor_rol       TEXT NOT NULL,
  accion          TEXT NOT NULL,
  detalles        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_institucion ON public.logs_auditoria(institucion_id);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON public.logs_auditoria(created_at DESC);

-- Habilitar RLS en logs de clientes
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_ver_misma_institucion" ON public.logs_auditoria;
CREATE POLICY "logs_ver_misma_institucion"
  ON public.logs_auditoria FOR SELECT
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

DROP POLICY IF EXISTS "logs_insert_misma_institucion" ON public.logs_auditoria;
CREATE POLICY "logs_insert_misma_institucion"
  ON public.logs_auditoria FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

-- 4. Redefinir contar_dentro para contar personas cuyo último registro es 'ingreso'
CREATE OR REPLACE FUNCTION public.contar_dentro(p_institucion_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT DISTINCT ON (documento) tipo_entrada
    FROM public.bitacora_accesos
    WHERE institucion_id = p_institucion_id
    ORDER BY documento, created_at DESC
  ) AS latest_status
  WHERE tipo_entrada = 'ingreso';

  RETURN COALESCE(v_count, 0);
END;
$$;

-- 5. Agregar columnas de vinculación de usuario en autorizaciones de salida
ALTER TABLE public.autorizaciones_salida 
  ADD COLUMN IF NOT EXISTS usuario_nombre VARCHAR(150),
  ADD COLUMN IF NOT EXISTS usuario_documento VARCHAR(50);

-- 6. Agregar columnas para Habeas Data y Demo de 20 días
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

-- 7. Crear tabla de logs para el panel de Super Admin
CREATE TABLE IF NOT EXISTS public.logs_superadmin (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_nombre  VARCHAR(150) NOT NULL,
  accion          TEXT NOT NULL, -- 'demo_iniciada', 'suscripcion_pagada', 'suscripcion_vencida', 'renovacion', 'capacitacion_agregada'
  monto           NUMERIC DEFAULT 0,
  tipo_plan       VARCHAR(50) NOT NULL,
  detalles        TEXT,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en logs de superadmin (solo superadmin puede ver/insertar)
ALTER TABLE public.logs_superadmin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_logs_all" ON public.logs_superadmin;
CREATE POLICY "superadmin_logs_all"
  ON public.logs_superadmin FOR ALL
  USING (public.usuario_rol() = 'superadmin');

-- 8. Habilitar replicación en tiempo real para mensajería y bitácora
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bitacora_accesos;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
