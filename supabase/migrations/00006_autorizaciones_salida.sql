-- ============================================================
-- Vigia - Autorizaciones de Salida de Objetos y Ajustes RLS
-- ============================================================

-- 1. Crear tabla de autorizaciones de salida
CREATE TABLE IF NOT EXISTS public.autorizaciones_salida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id UUID REFERENCES public.instituciones(id) ON DELETE CASCADE,
  tipo_objeto VARCHAR(100) NOT NULL,
  serial VARCHAR(100) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  autoriza_salida BOOLEAN NOT NULL DEFAULT true,
  codigo_autorizacion VARCHAR(20) NOT NULL UNIQUE,
  creador_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creador_nombre VARCHAR(150) NOT NULL,
  usada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.autorizaciones_salida ENABLE ROW LEVEL SECURITY;

-- Crear políticas para autorizaciones
CREATE POLICY "autorizaciones_ver_misma_institucion" ON public.autorizaciones_salida FOR SELECT
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

CREATE POLICY "autorizaciones_insert_misma_institucion" ON public.autorizaciones_salida FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

CREATE POLICY "autorizaciones_update_misma_institucion" ON public.autorizaciones_salida FOR UPDATE
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');


-- 2. RECREAR POLÍTICAS RLS PARA PERMITIR BYPASS DE SUPERADMIN
-- Evita errores al consultar datos cuando se inicia sesión como superadmin (con institucion_id NULL)

-- Tabla: turnos
DROP POLICY IF EXISTS "turnos_ver_misma_institucion" ON public.turnos;
DROP POLICY IF EXISTS "turnos_insert_misma_institucion" ON public.turnos;
DROP POLICY IF EXISTS "turnos_update_misma_institucion" ON public.turnos;

CREATE POLICY "turnos_ver_misma_institucion" ON public.turnos FOR SELECT
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');
CREATE POLICY "turnos_insert_misma_institucion" ON public.turnos FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');
CREATE POLICY "turnos_update_misma_institucion" ON public.turnos FOR UPDATE
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

-- Tabla: novedades
DROP POLICY IF EXISTS "novedades_ver_misma_institucion" ON public.novedades;
DROP POLICY IF EXISTS "novedades_insert_misma_institucion" ON public.novedades;

CREATE POLICY "novedades_ver_misma_institucion" ON public.novedades FOR SELECT
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');
CREATE POLICY "novedades_insert_misma_institucion" ON public.novedades FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

-- Tabla: mensajes
DROP POLICY IF EXISTS "mensajes_ver_misma_institucion" ON public.mensajes;
DROP POLICY IF EXISTS "mensajes_insert_misma_institucion" ON public.mensajes;

CREATE POLICY "mensajes_ver_misma_institucion" ON public.mensajes FOR SELECT
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');
CREATE POLICY "mensajes_insert_misma_institucion" ON public.mensajes FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

-- Tabla: bitacora_accesos
DROP POLICY IF EXISTS "accesos_ver_misma_institucion" ON public.bitacora_accesos;
DROP POLICY IF EXISTS "accesos_insert_misma_institucion" ON public.bitacora_accesos;

CREATE POLICY "accesos_ver_misma_institucion" ON public.bitacora_accesos FOR SELECT
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');
CREATE POLICY "accesos_insert_misma_institucion" ON public.bitacora_accesos FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');
