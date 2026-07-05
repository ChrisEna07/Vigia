-- ============================================================
-- Vigia - Corrección de Trigger de Registro y Nulabilidad
-- ============================================================

-- 1. Permitir que la institución sea NULL (los superadmins no pertenecen a un tenant en específico)
ALTER TABLE public.usuarios ALTER COLUMN institucion_id DROP NOT NULL;

-- 2. Actualizar la función del trigger para que maneje la ausencia de institucion_id
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_inst_id UUID;
BEGIN
  -- Casteo seguro de institucion_id desde metadata de auth
  BEGIN
    v_inst_id := (NEW.raw_user_meta_data->>'institucion_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_inst_id := NULL;
  END;

  INSERT INTO public.usuarios (id, institucion_id, nombre_completo, email, rol, activo)
  VALUES (
    NEW.id,
    v_inst_id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'vigilante')::TEXT,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    institucion_id = EXCLUDED.institucion_id,
    nombre_completo = EXCLUDED.nombre_completo,
    rol = EXCLUDED.rol;

  RETURN NEW;
END;
$$;
