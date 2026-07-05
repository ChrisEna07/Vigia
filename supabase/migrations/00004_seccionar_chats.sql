-- ============================================================
-- Vigia - Particionamiento de Chats por Vigilante
-- ============================================================

-- 1. Agregar columna vigilante_id a la tabla de mensajes
ALTER TABLE public.mensajes 
  ADD COLUMN IF NOT EXISTS vigilante_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE;

-- 2. Actualizar mensajes antiguos para asignarles el vigilante_id (asumiendo que el remitente era el vigilante)
UPDATE public.mensajes 
SET vigilante_id = remitente_id 
WHERE vigilante_id IS NULL;

-- 3. Crear índice para acelerar las consultas por chat de vigilante
CREATE INDEX IF NOT EXISTS idx_mensajes_vigilante ON public.mensajes(vigilante_id);
