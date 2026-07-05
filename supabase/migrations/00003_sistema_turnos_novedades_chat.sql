-- ============================================================
-- Vigia - Sistema de Turnos, Novedades, Mensajería y Perfiles
-- ============================================================

-- 1. Agregar campos a public.usuarios para gestión de vigilantes
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS documento TEXT,
  ADD COLUMN IF NOT EXISTS observaciones_admin TEXT,
  ADD COLUMN IF NOT EXISTS dias_laborales TEXT[] DEFAULT ARRAY['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

-- 2. Tabla de Turnos de Vigilantes
CREATE TABLE IF NOT EXISTS public.turnos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  vigilante_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  inicio_turno    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fin_turno       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_institucion ON public.turnos(institucion_id);
CREATE INDEX IF NOT EXISTS idx_turnos_vigilante ON public.turnos(vigilante_id);

-- 3. Tabla de Novedades de Turno
CREATE TABLE IF NOT EXISTS public.novedades (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  vigilante_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  turno_id        UUID REFERENCES public.turnos(id) ON DELETE SET NULL,
  titulo          TEXT NOT NULL,
  descripcion     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novedades_institucion ON public.novedades(institucion_id);
CREATE INDEX IF NOT EXISTS idx_novedades_vigilante ON public.novedades(vigilante_id);

-- 4. Tabla de Mensajería en Tiempo Real (Chat)
CREATE TABLE IF NOT EXISTS public.mensajes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institucion_id    UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  remitente_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  remitente_nombre  TEXT NOT NULL,
  contenido         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_institucion ON public.mensajes(institucion_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON public.mensajes(created_at DESC);

-- ============================================================
-- 5. Activar Seguridad a Nivel de Fila (RLS)
-- ============================================================
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para Turnos
DROP POLICY IF EXISTS "turnos_ver_misma_institucion" ON public.turnos;
CREATE POLICY "turnos_ver_misma_institucion"
  ON public.turnos FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

DROP POLICY IF EXISTS "turnos_insert_misma_institucion" ON public.turnos;
CREATE POLICY "turnos_insert_misma_institucion"
  ON public.turnos FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id());

DROP POLICY IF EXISTS "turnos_update_misma_institucion" ON public.turnos;
CREATE POLICY "turnos_update_misma_institucion"
  ON public.turnos FOR UPDATE
  USING (institucion_id = public.usuario_institucion_id());

-- 7. Políticas RLS para Novedades
DROP POLICY IF EXISTS "novedades_ver_misma_institucion" ON public.novedades;
CREATE POLICY "novedades_ver_misma_institucion"
  ON public.novedades FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

DROP POLICY IF EXISTS "novedades_insert_misma_institucion" ON public.novedades;
CREATE POLICY "novedades_insert_misma_institucion"
  ON public.novedades FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id());

-- 8. Políticas RLS para Mensajes
DROP POLICY IF EXISTS "mensajes_ver_misma_institucion" ON public.mensajes;
CREATE POLICY "mensajes_ver_misma_institucion"
  ON public.mensajes FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

DROP POLICY IF EXISTS "mensajes_insert_misma_institucion" ON public.mensajes;
CREATE POLICY "mensajes_insert_misma_institucion"
  ON public.mensajes FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id());

-- 9. Redefinir crear_usuario_admin para permitir que administradores de institución creen sus vigilantes
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
  v_user_id UUID;
  v_caller_rol TEXT;
  v_caller_inst_id UUID;
  v_new_user_id UUID;
BEGIN
  -- Obtener rol e institucion del invocador
  SELECT rol, institucion_id INTO v_caller_rol, v_caller_inst_id 
  FROM public.usuarios WHERE id = auth.uid();

  -- Validar permisos
  IF v_caller_rol != 'superadmin' AND (v_caller_rol != 'admin_institucion' OR v_caller_inst_id != p_institucion_id) THEN
    RAISE EXCEPTION 'No tienes permisos para crear usuarios en esta institución.';
  END IF;

  -- Generar UUID para el nuevo usuario
  v_new_user_id := gen_random_uuid();

  -- Insertar en auth.users
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role,
    confirmation_token, email_change, email_change_token_new, email_change_token_current, recovery_token, phone_change_token, reauthentication_token
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
    '', '', '', '', '', '', ''
  );

  -- Insertar manualmente en public.usuarios con los datos adicionales si es necesario (el trigger handle_new_auth_user se encarga de lo básico, pero podemos actualizarlo despues o dejar que inserte)
  -- El trigger on_auth_user_created hará la inserción en public.usuarios.
  
  RETURN v_new_user_id;
END;
$$;
