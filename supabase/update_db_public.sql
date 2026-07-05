-- ============================================================
-- Vigia - Actualización del Esquema Público (Seguro y Sin Permisos de Auth)
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. Agregar columnas a public.usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS acepta_datos_ley BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_aceptacion_ley TIMESTAMPTZ;

-- 1.1 Agregar columnas a public.turnos
ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS motivo_cierre_anticipado TEXT,
  ADD COLUMN IF NOT EXISTS motivo_entrada_tarde TEXT;


-- 2. Agregar columnas a public.instituciones
ALTER TABLE public.instituciones
  ADD COLUMN IF NOT EXISTS acepta_datos_ley BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_aceptacion_ley TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS en_demo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS inicio_demo DATE,
  ADD COLUMN IF NOT EXISTS limite_demo DATE,
  ADD COLUMN IF NOT EXISTS tiene_capacitacion BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS horas_capacitacion INTEGER DEFAULT 0;

-- 3. Agregar columnas a public.mensajes y public.novedades
ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT false;

ALTER TABLE public.novedades
  ADD COLUMN IF NOT EXISTS creador_id UUID REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS evidencia_url TEXT;

UPDATE public.novedades SET creador_id = vigilante_id WHERE creador_id IS NULL;

-- 4. Crear tabla de logs para el panel de Super Admin (si no existe)
CREATE TABLE IF NOT EXISTS public.logs_superadmin (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_nombre  VARCHAR(150) NOT NULL,
  accion          TEXT NOT NULL, -- 'demo_iniciada', 'suscripcion_pagada', 'suscripcion_vencida', 'renovacion', 'capacitacion_agregada'
  monto           NUMERIC DEFAULT 0,
  tipo_plan       VARCHAR(50) NOT NULL,
  detalles        TEXT,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en logs de superadmin
ALTER TABLE public.logs_superadmin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_logs_all" ON public.logs_superadmin;
CREATE POLICY "superadmin_logs_all"
  ON public.logs_superadmin FOR ALL
  USING (public.usuario_rol() = 'superadmin');

-- 5. Crear tabla de logs de auditoría para clientes/admin locales (si no existe)
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 6. Modificar remitente_id en soporte_mensajes para ser opcional
ALTER TABLE public.soporte_mensajes
  ALTER COLUMN remitente_id DROP NOT NULL;

-- 7. Actualizar políticas de RLS para soporte_mensajes
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

-- 8. Crear tabla de anuncios y updates
CREATE TABLE IF NOT EXISTS public.anuncios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        VARCHAR(250) NOT NULL,
  descripcion   TEXT NOT NULL,
  tipo          VARCHAR(50) NOT NULL, -- 'web', 'movil', 'ambos'
  fecha_inicio  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en anuncios
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anuncios_ver_todos" ON public.anuncios;
CREATE POLICY "anuncios_ver_todos" ON public.anuncios FOR SELECT
  USING (true); -- Cualquier usuario autenticado puede leer anuncios

DROP POLICY IF EXISTS "anuncios_superadmin_all" ON public.anuncios;
CREATE POLICY "anuncios_superadmin_all" ON public.anuncios FOR ALL
  USING (public.usuario_rol() = 'superadmin');

-- 9. Habilitar replicación en tiempo real en las tablas requeridas
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bitacora_accesos;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.soporte_mensajes;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.soporte_tickets;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.anuncios;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
