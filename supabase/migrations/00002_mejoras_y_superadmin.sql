-- ============================================================
-- Vigia - Mejoras, Validaciones y Super Admin
-- ============================================================

-- 1. Actualizar check de tipo_documento para incluir PPT
ALTER TABLE public.bitacora_accesos
  DROP CONSTRAINT IF EXISTS bitacora_accesos_tipo_documento_check;

ALTER TABLE public.bitacora_accesos
  ADD CONSTRAINT bitacora_accesos_tipo_documento_check
  CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte', 'PPT', 'Otro'));

-- 2. Función y trigger para impedir ingresos/salidas duplicadas consecutivas
CREATE OR REPLACE FUNCTION public.validar_registro_acceso()
RETURNS TRIGGER AS $$
DECLARE
  v_ultimo_tipo TEXT;
BEGIN
  -- Obtener el último tipo de registro para este documento en esta institución
  SELECT tipo_entrada INTO v_ultimo_tipo
  FROM public.bitacora_accesos
  WHERE institucion_id = NEW.institucion_id
    AND documento = NEW.documento
  ORDER BY created_at DESC
  LIMIT 1;

  -- Si es un ingreso, no puede haber otro ingreso activo sin una salida
  IF NEW.tipo_entrada = 'ingreso' AND v_ultimo_tipo = 'ingreso' THEN
    RAISE EXCEPTION 'La persona con documento % ya registra un ingreso activo.', NEW.documento;
  END IF;

  -- Si es una salida, debe tener un ingreso previo y no haber salido ya
  IF NEW.tipo_entrada = 'salida' AND (v_ultimo_tipo IS NULL OR v_ultimo_tipo = 'salida') THEN
    RAISE EXCEPTION 'La persona con documento % no registra un ingreso activo o ya salió.', NEW.documento;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER check_registro_acceso_duplicado
  BEFORE INSERT ON public.bitacora_accesos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_registro_acceso();

-- 3. Función segura para que el superadmin pueda crear nuevos usuarios en auth.users
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
BEGIN
  -- Verificar si el invocador es superadmin
  IF (SELECT rol FROM public.usuarios WHERE id = auth.uid()) != 'superadmin' THEN
    RAISE EXCEPTION 'Solo los superadmins pueden crear nuevos usuarios administradores.';
  END IF;

  -- Insertar en auth.users
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role,
    confirmation_token, email_change, email_change_token_new, email_change_token_current, recovery_token, phone_change_token, reauthentication_token
  )
  VALUES (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
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
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;
