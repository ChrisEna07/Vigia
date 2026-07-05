-- ============================================================
-- Vigia - Suscripciones y Módulo de Soporte
-- ============================================================

-- 1. Agregar campos de suscripción a public.instituciones
ALTER TABLE public.instituciones
  ADD COLUMN IF NOT EXISTS plan_suscripcion VARCHAR(50) DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS monto_mensual NUMERIC(10,2) DEFAULT 29.99,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS estado_suscripcion VARCHAR(20) DEFAULT 'activa' CHECK (estado_suscripcion IN ('activa', 'vencida', 'cancelada'));

-- 2. Tabla de Tickets de Soporte
CREATE TABLE IF NOT EXISTS public.soporte_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id  UUID NOT NULL REFERENCES public.instituciones(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  usuario_nombre  VARCHAR(150) NOT NULL,
  titulo          VARCHAR(250) NOT NULL,
  descripcion     TEXT NOT NULL,
  estado          VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_progreso', 'resuelto')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soporte_tickets_inst ON public.soporte_tickets(institucion_id);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_estado ON public.soporte_tickets(estado);

-- 3. Tabla de Mensajes del Chat de Soporte
CREATE TABLE IF NOT EXISTS public.soporte_mensajes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES public.soporte_tickets(id) ON DELETE CASCADE,
  remitente_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  remitente_nombre  VARCHAR(150) NOT NULL,
  contenido         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soporte_mensajes_ticket ON public.soporte_mensajes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_soporte_mensajes_fecha ON public.soporte_mensajes(created_at ASC);

-- 4. Habilitar Seguridad RLS
ALTER TABLE public.soporte_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soporte_mensajes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Tickets
DROP POLICY IF EXISTS "soporte_tickets_ver" ON public.soporte_tickets;
CREATE POLICY "soporte_tickets_ver" ON public.soporte_tickets FOR SELECT
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

DROP POLICY IF EXISTS "soporte_tickets_insert" ON public.soporte_tickets;
CREATE POLICY "soporte_tickets_insert" ON public.soporte_tickets FOR INSERT
  WITH CHECK (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

DROP POLICY IF EXISTS "soporte_tickets_update" ON public.soporte_tickets;
CREATE POLICY "soporte_tickets_update" ON public.soporte_tickets FOR UPDATE
  USING (institucion_id = public.usuario_institucion_id() OR public.usuario_rol() = 'superadmin');

-- Políticas de RLS para Mensajes
DROP POLICY IF EXISTS "soporte_mensajes_ver" ON public.soporte_mensajes;
CREATE POLICY "soporte_mensajes_ver" ON public.soporte_mensajes FOR SELECT
  USING (
    ticket_id IN (SELECT id FROM public.soporte_tickets WHERE institucion_id = public.usuario_institucion_id()) 
    OR public.usuario_rol() = 'superadmin'
  );

DROP POLICY IF EXISTS "soporte_mensajes_insert" ON public.soporte_mensajes;
CREATE POLICY "soporte_mensajes_insert" ON public.soporte_mensajes FOR INSERT
  WITH CHECK (
    ticket_id IN (SELECT id FROM public.soporte_tickets WHERE institucion_id = public.usuario_institucion_id()) 
    OR public.usuario_rol() = 'superadmin'
  );
