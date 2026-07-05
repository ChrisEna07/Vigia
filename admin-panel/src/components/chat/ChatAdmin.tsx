import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Vigilante {
  id: string;
  nombre_completo: string;
  email: string;
  activo: boolean;
}

interface Mensaje {
  id: string;
  remitente_id: string;
  remitente_nombre: string;
  contenido: string;
  created_at: string;
  vigilante_id: string;
}

export default function ChatAdmin() {
  const { user, institucionId, loading: authLoading } = useSession();
  
  // States
  const [vigilantes, setVigilantes] = useState<Vigilante[]>([]);
  const [selectedVigId, setSelectedVigId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const cargarConteosNoLeidos = async () => {
    if (!institucionId || !user?.id) return;
    const { data } = await supabase
      .from('mensajes')
      .select('vigilante_id')
      .eq('institucion_id', institucionId)
      .neq('remitente_id', user.id)
      .eq('leido', false);

    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((msg) => {
        counts[msg.vigilante_id] = (counts[msg.vigilante_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  // 1. Fetch vigilantes list and initial unread counts
  useEffect(() => {
    if (!institucionId) return;
    cargarVigilantes();
    cargarConteosNoLeidos();

    // Subscribe to all changes in the mensajes table to refresh counts
    const globalChannel = supabase
      .channel('chat-admin-global-unread')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mensajes',
        filter: `institucion_id=eq.${institucionId}`,
      }, () => {
        cargarConteosNoLeidos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [institucionId, user?.id]);

  // 2. Fetch messages and subscribe to selected vigilante chat
  useEffect(() => {
    if (!institucionId || !selectedVigId) {
      setMensajes([]);
      return;
    }

    cargarMensajes(selectedVigId);

    // Subscribe to inserts specifically for this vigilante chat
    const channel = supabase
      .channel(`chat-admin-vigilante-${selectedVigId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `vigilante_id=eq.${selectedVigId}`,
      }, async (payload) => {
        setMensajes((prev) => {
          // Prevent duplicates
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Mensaje];
        });

        // Mark as read immediately on database
        if (payload.new.remitente_id !== user?.id) {
          await supabase
            .from('mensajes')
            .update({ leido: true })
            .eq('id', payload.new.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [institucionId, selectedVigId]);

  // Scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const cargarVigilantes = async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from('usuarios')
      .select('id,nombre_completo,email,activo')
      .eq('institucion_id', institucionId)
      .eq('rol', 'vigilante')
      .order('nombre_completo', { ascending: true });

    if (data) setVigilantes(data as Vigilante[]);
    setLoadingList(false);
  };

  const cargarMensajes = async (vigId: string) => {
    setLoadingChat(true);

    try {
      await supabase
        .from('mensajes')
        .update({ leido: true })
        .eq('institucion_id', institucionId)
        .eq('vigilante_id', vigId)
        .neq('remitente_id', user?.id)
        .eq('leido', false);
      
      // Clear in local state immediately
      setUnreadCounts((prev) => ({ ...prev, [vigId]: 0 }));
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }

    const { data } = await supabase
      .from('mensajes')
      .select('*')
      .eq('institucion_id', institucionId)
      .eq('vigilante_id', vigId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setMensajes(data.reverse());
    }
    setLoadingChat(false);
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !user || !selectedVigId) return;

    try {
      const { error } = await supabase.from('mensajes').insert({
        institucion_id: institucionId,
        remitente_id: user.id,
        remitente_nombre: 'Administración',
        contenido: nuevoMensaje.trim(),
        vigilante_id: selectedVigId,
      });

      if (error) throw error;
      setNuevoMensaje('');
    } catch (err) {
      console.error('Error al enviar el mensaje:', err);
    }
  };

  if (authLoading || loadingList) return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center h-[500px]">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeVigilante = vigilantes.find(v => v.id === selectedVigId);

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl flex h-[500px] overflow-hidden">
      {/* Left Sidebar: Vigilantes List */}
      <div className="w-64 border-r border-surface-border flex flex-col bg-surface-card">
        <div className="p-4 border-b border-surface-border">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Vigilantes</h3>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
          {vigilantes.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVigId(v.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                selectedVigId === v.id
                  ? 'bg-accent/15 text-accent-bright border-l-2 border-accent'
                  : 'hover:bg-surface-elevated/40 text-text-secondary'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-xs font-bold uppercase shrink-0">
                {v.nombre_completo.charAt(0)}
              </div>
              <div className="min-w-0 flex-1 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold truncate">{v.nombre_completo}</p>
                  <p className={`text-[10px] ${v.activo ? 'text-accent' : 'text-text-muted'}`}>
                    {v.activo ? 'Activo' : 'Inactivo'}
                  </p>
                </div>
                {unreadCounts[v.id] > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center shrink-0 animate-pulse">
                    {unreadCounts[v.id]}
                  </span>
                )}
              </div>
            </button>
          ))}
          {vigilantes.length === 0 && (
            <div className="p-4 text-center text-xs text-text-muted">
              No hay vigilantes registrados.
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Selected Vigilante Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface/20">
        {selectedVigId && activeVigilante ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-surface-border bg-surface-card flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                  Conversación con {activeVigilante.nombre_completo}
                </h4>
                <p className="text-[10px] text-text-muted mt-0.5">{activeVigilante.email}</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingChat ? (
                <div className="h-full flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                mensajes.map((m) => {
                  const esPropio = m.remitente_id === user?.id || m.remitente_nombre === 'Administración';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${esPropio ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-xl text-xs ${
                          esPropio
                            ? 'bg-accent text-black rounded-tr-none font-medium'
                            : 'bg-surface-card border border-surface-border text-text-primary rounded-tl-none'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{m.contenido}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
              {!loadingChat && mensajes.length === 0 && (
                <div className="h-full flex items-center justify-center text-xs text-text-muted">
                  No hay mensajes. Escribe uno abajo para iniciar la conversación.
                </div>
              )}
            </div>

            {/* Input box */}
            <form onSubmit={handleEnviar} className="p-3 bg-surface-card border-t border-surface-border flex gap-2">
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                className="flex-1 bg-surface border border-surface-border rounded-xl px-4 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
              />
              <button
                type="submit"
                className="bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl px-4 py-2 text-xs transition-colors"
              >
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
            Selecciona un vigilante en la barra lateral para abrir su chat.
          </div>
        )}
      </div>
    </div>
  );
}
