-- ============================================================
-- Vigia - Esquema Inicial Supabase
-- ============================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabla: instituciones (tenants)
CREATE TABLE public.instituciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla: usuarios (vinculada a auth.users)
CREATE TABLE public.usuarios (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  rol             TEXT NOT NULL CHECK (rol IN ('superadmin', 'admin_institucion', 'vigilante')),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_usuarios_institucion ON public.usuarios(institucion_id);
CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);

-- 4. Tabla: modulos_config (qué registra cada institución)
CREATE TABLE public.modulos_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  modulo          TEXT NOT NULL CHECK (modulo IN ('vehiculos', 'portatiles', 'visitantes')),
  activo          BOOLEAN NOT NULL DEFAULT FALSE,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institucion_id, modulo)
);

-- 5. Tabla principal: bitacora_accesos
CREATE TABLE public.bitacora_accesos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  vigilante_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  -- Datos de la persona que accede
  nombre          TEXT NOT NULL,
  documento       TEXT NOT NULL,
  tipo_documento  TEXT DEFAULT 'CC' CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte', 'Otro')),
  tipo_entrada    TEXT NOT NULL CHECK (tipo_entrada IN ('ingreso', 'salida')),
  -- Campos opcionales según módulos activos
  datos_jsonb     JSONB DEFAULT '{}',
  -- Metadata
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bitacora_institucion ON public.bitacora_accesos(institucion_id);
CREATE INDEX idx_bitacora_vigilante ON public.bitacora_accesos(vigilante_id);
CREATE INDEX idx_bitacora_fecha ON public.bitacora_accesos(created_at DESC);
CREATE INDEX idx_bitacora_documento ON public.bitacora_accesos(documento);

-- 6. Vista materializada: vehículos vinculados a un acceso
CREATE TABLE public.vehiculos_acceso (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bitacora_id     UUID NOT NULL REFERENCES public.bitacora_accesos(id) ON DELETE CASCADE,
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  placa           TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('particular', 'moto', 'camion', 'bicicleta', 'otro')),
  marca           TEXT,
  color           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vehiculos_bitacora ON public.vehiculos_acceso(bitacora_id);
CREATE INDEX idx_vehiculos_placa ON public.vehiculos_acceso(placa);

CREATE TABLE public.equipos_acceso (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bitacora_id     UUID NOT NULL REFERENCES public.bitacora_accesos(id) ON DELETE CASCADE,
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('portatil', 'tablet', 'monitor', 'herramienta', 'otro')),
  marca           TEXT NOT NULL,
  serial          TEXT NOT NULL,
  descripcion     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_equipos_bitacora ON public.equipos_acceso(bitacora_id);
CREATE INDEX idx_equipos_serial ON public.equipos_acceso(serial);

-- ============================================================
-- 7. Políticas de Seguridad de Nivel de Fila (RLS)
-- ============================================================

-- 7a. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_instituciones
  BEFORE UPDATE ON public.instituciones
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at_usuarios
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at_modulos_config
  BEFORE UPDATE ON public.modulos_config
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 7b. Función helper para obtener institución del usuario actual
CREATE OR REPLACE FUNCTION public.usuario_institucion_id()
RETURNS UUID
STABLE LANGUAGE SQL AS $$
  SELECT institucion_id FROM public.usuarios WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.usuario_rol()
RETURNS TEXT
STABLE LANGUAGE SQL AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid()
$$;

-- 7c. Activar RLS en todas las tablas
ALTER TABLE public.instituciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulos_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitacora_accesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos_acceso ENABLE ROW LEVEL SECURITY;

-- 7d. Políticas

-- instituciones: solo superadmin puede ver todas; admin/vigilante solo su propia institución
CREATE POLICY "superadmin_ver_todas_instituciones"
  ON public.instituciones FOR SELECT
  USING (public.usuario_rol() = 'superadmin');

CREATE POLICY "usuarios_ver_su_institucion"
  ON public.instituciones FOR SELECT
  USING (id = public.usuario_institucion_id());

-- Solo superadmin puede insertar/actualizar/eliminar instituciones
CREATE POLICY "superadmin_insert_instituciones"
  ON public.instituciones FOR INSERT
  WITH CHECK (public.usuario_rol() = 'superadmin');

CREATE POLICY "superadmin_update_instituciones"
  ON public.instituciones FOR UPDATE
  USING (public.usuario_rol() = 'superadmin');

CREATE POLICY "superadmin_delete_instituciones"
  ON public.instituciones FOR DELETE
  USING (public.usuario_rol() = 'superadmin');

-- usuarios: cada rol ve según su alcance
CREATE POLICY "usuarios_ver_misma_institucion"
  ON public.usuarios FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

CREATE POLICY "superadmin_ver_todos_usuarios"
  ON public.usuarios FOR SELECT
  USING (public.usuario_rol() = 'superadmin');

-- Solo superadmin y admin_institucion pueden insertar/actualizar usuarios de su institución
CREATE POLICY "admin_insert_usuarios_misma_institucion"
  ON public.usuarios FOR INSERT
  WITH CHECK (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('superadmin', 'admin_institucion')
  );

CREATE POLICY "admin_update_usuarios_misma_institucion"
  ON public.usuarios FOR UPDATE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('superadmin', 'admin_institucion')
  );

CREATE POLICY "admin_delete_usuarios_misma_institucion"
  ON public.usuarios FOR DELETE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('superadmin', 'admin_institucion')
  );

-- modulos_config: visible para todos los miembros de la institución
CREATE POLICY "modulos_ver_misma_institucion"
  ON public.modulos_config FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

CREATE POLICY "admin_gestiona_modulos"
  ON public.modulos_config FOR INSERT
  WITH CHECK (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('superadmin', 'admin_institucion')
  );

CREATE POLICY "admin_update_modulos"
  ON public.modulos_config FOR UPDATE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('superadmin', 'admin_institucion')
  );

CREATE POLICY "admin_delete_modulos"
  ON public.modulos_config FOR DELETE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('superadmin', 'admin_institucion')
  );

-- bitacora_accesos: cada uno ve los registros de su institución
CREATE POLICY "bitacora_ver_misma_institucion"
  ON public.bitacora_accesos FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

-- Vigilantes y admins pueden insertar accesos
CREATE POLICY "vigilante_insert_accesos"
  ON public.bitacora_accesos FOR INSERT
  WITH CHECK (
    institucion_id = public.usuario_institucion_id()
    AND vigilante_id = auth.uid()
    AND public.usuario_rol() IN ('vigilante', 'admin_institucion', 'superadmin')
  );

-- Solo admin/superadmin puede actualizar/eliminar accesos
CREATE POLICY "admin_update_accesos"
  ON public.bitacora_accesos FOR UPDATE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('admin_institucion', 'superadmin')
  );

CREATE POLICY "admin_delete_accesos"
  ON public.bitacora_accesos FOR DELETE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('admin_institucion', 'superadmin')
  );

-- vehiculos_acceso: mismas reglas que bitacora
CREATE POLICY "vehiculos_ver_misma_institucion"
  ON public.vehiculos_acceso FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

CREATE POLICY "vigilante_insert_vehiculos"
  ON public.vehiculos_acceso FOR INSERT
  WITH CHECK (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('vigilante', 'admin_institucion', 'superadmin')
  );

CREATE POLICY "admin_update_vehiculos"
  ON public.vehiculos_acceso FOR UPDATE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('admin_institucion', 'superadmin')
  );

CREATE POLICY "admin_delete_vehiculos"
  ON public.vehiculos_acceso FOR DELETE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('admin_institucion', 'superadmin')
  );

-- equipos_acceso: mismas reglas que bitacora
CREATE POLICY "equipos_ver_misma_institucion"
  ON public.equipos_acceso FOR SELECT
  USING (institucion_id = public.usuario_institucion_id());

CREATE POLICY "vigilante_insert_equipos"
  ON public.equipos_acceso FOR INSERT
  WITH CHECK (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('vigilante', 'admin_institucion', 'superadmin')
  );

CREATE POLICY "admin_update_equipos"
  ON public.equipos_acceso FOR UPDATE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('admin_institucion', 'superadmin')
  );

CREATE POLICY "admin_delete_equipos"
  ON public.equipos_acceso FOR DELETE
  USING (
    institucion_id = public.usuario_institucion_id()
    AND public.usuario_rol() IN ('admin_institucion', 'superadmin')
  );

-- ============================================================
-- 8. Función para sincronizar usuario desde auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usuarios (id, institucion_id, nombre_completo, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'institucion_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'vigilante')::TEXT
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- 9. Función RPC: contar personas dentro de la institución
-- ============================================================
CREATE OR REPLACE FUNCTION public.contar_dentro(p_institucion_id UUID)
RETURNS BIGINT
LANGUAGE SQL
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT COUNT(*) FROM public.bitacora_accesos
    WHERE institucion_id = p_institucion_id
      AND tipo_entrada = 'ingreso'
      AND created_at::date = CURRENT_DATE
  ), 0) - COALESCE((
    SELECT COUNT(*) FROM public.bitacora_accesos
    WHERE institucion_id = p_institucion_id
      AND tipo_entrada = 'salida'
      AND created_at::date = CURRENT_DATE
  ), 0);
$$;
