-- ============================================================
-- Vigia - Datos de prueba (v2: usa auth.create_user)
-- ============================================================
-- Ejecutar en el Editor SQL de Supabase Dashboard
-- El trigger on_auth_user_created inserta automáticamente
-- en public.usuarios usando los metadatos.

-- Limpiar ejecuciones previas (seed re-ejecutable)
DELETE FROM public.equipos_acceso WHERE institucion_id IN (SELECT id FROM public.instituciones WHERE slug = 'demo');
DELETE FROM public.vehiculos_acceso WHERE institucion_id IN (SELECT id FROM public.instituciones WHERE slug = 'demo');
DELETE FROM public.bitacora_accesos WHERE institucion_id IN (SELECT id FROM public.instituciones WHERE slug = 'demo');
DELETE FROM public.modulos_config WHERE institucion_id IN (SELECT id FROM public.instituciones WHERE slug = 'demo');
DELETE FROM public.usuarios WHERE email IN ('admin@test.com', 'vigilante@test.com', 'Chrizdev07@gmail.com');
DELETE FROM auth.users WHERE email IN ('admin@test.com', 'vigilante@test.com', 'Chrizdev07@gmail.com');
DELETE FROM public.instituciones WHERE slug = 'demo';

-- Crear institución demo
WITH nueva_institucion AS (
  INSERT INTO public.instituciones (nombre, slug)
  VALUES ('Institución Demo', 'demo')
  RETURNING id
),
-- Crear admin via función nativa (password hasheado correctamente)
admin_created AS (
  SELECT auth.create_user(jsonb_build_object(
    'email', 'admin@test.com',
    'password', 'Admin123!',
    'email_confirm', true,
    'user_metadata', jsonb_build_object(
      'institucion_id', (SELECT id FROM nueva_institucion),
      'nombre_completo', 'Admin Demo',
      'rol', 'admin_institucion'
    )
  )) AS id
),
-- Crear vigilante
vigilante_created AS (
  SELECT auth.create_user(jsonb_build_object(
    'email', 'vigilante@test.com',
    'password', 'Vigilante1!',
    'email_confirm', true,
    'user_metadata', jsonb_build_object(
      'institucion_id', (SELECT id FROM nueva_institucion),
      'nombre_completo', 'Vigilante Demo',
      'rol', 'vigilante'
    )
  )) AS id
),
-- Crear superadmin ChrizDev
superadmin_created AS (
  SELECT auth.create_user(jsonb_build_object(
    'email', 'Chrizdev07@gmail.com',
    'password', 'ChrizDev07*',
    'email_confirm', true,
    'user_metadata', jsonb_build_object(
      'institucion_id', (SELECT id FROM nueva_institucion),
      'nombre_completo', 'ChrizDev',
      'rol', 'superadmin'
    )
  )) AS id
),
-- Módulos activos
modulos_inserted AS (
  INSERT INTO public.modulos_config (institucion_id, modulo, activo)
  SELECT id, 'vehiculos', true FROM nueva_institucion
  UNION ALL
  SELECT id, 'portatiles', true FROM nueva_institucion
  UNION ALL
  SELECT id, 'visitantes', false FROM nueva_institucion
  RETURNING id
)
SELECT 'Seed: usuarios y módulos creados correctamente' AS resultado;

-- Insertar accesos de ejemplo
DO $$
DECLARE
  v_inst_id UUID;
  v_vigilante_id UUID;
BEGIN
  SELECT id INTO v_inst_id FROM public.instituciones WHERE slug = 'demo';
  SELECT id INTO v_vigilante_id FROM public.usuarios WHERE email = 'vigilante@test.com';

  INSERT INTO public.bitacora_accesos (institucion_id, vigilante_id, nombre, documento, tipo_entrada)
  VALUES (v_inst_id, v_vigilante_id, 'Carlos Méndez', 'CC-12345678', 'ingreso');

  INSERT INTO public.bitacora_accesos (institucion_id, vigilante_id, nombre, documento, tipo_entrada)
  VALUES (v_inst_id, v_vigilante_id, 'Ana López', 'CC-98765432', 'salida');
END $$;

-- ============================================================
-- CREDENCIALES DE PRUEBA
-- ============================================================
-- Admin:     admin@test.com / Admin123!
-- Vigilante: vigilante@test.com / Vigilante1!
-- ============================================================

-- Reparar valores NULL en la tabla auth.users (evita el error "Database error querying schema" al hacer login)
UPDATE auth.users
SET confirmation_token = COALESCE(confirmation_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    recovery_token = COALESCE(recovery_token, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
WHERE email IN ('admin@test.com', 'vigilante@test.com', 'Chrizdev07@gmail.com');
