import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Ticket {
  id: string;
  institucion_id: string;
  usuario_id: string;
  usuario_nombre: string;
  titulo: string;
  descripcion: string;
  estado: 'abierto' | 'en_progreso' | 'resuelto';
  created_at: string;
  institucion?: {
    nombre: string;
  };
}

interface Mensaje {
  id: string;
  ticket_id: string;
  remitente_id: string;
  remitente_nombre: string;
  contenido: string;
  created_at: string;
}

export default function GestorSoporte() {
  const { user, userEmail, userRol, institucionId, loading: authLoading } = useSession();
  const userId = user?.id;
  const userInstId = institucionId;

  // List States
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // Chat States
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // New Ticket Form States (for Institution Admins)
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitulo, setNewTitulo] = useState('');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Alert State
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    cargarTickets();

    // Subscribe to new support tickets for real-time alerts if Super Admin
    let subscription: any;
    if (userRol === 'superadmin') {
      subscription = supabase
        .channel('realtime:soporte_tickets')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'soporte_tickets' },
          (payload) => {
            setTickets((prev) => [payload.new as Ticket, ...prev]);
            mostrarMensaje('success', '¡Se ha registrado un nuevo ticket de soporte!');
          }
        )
        .subscribe();
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [authLoading, userRol]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Subscribe to real-time messages when a ticket is opened
  useEffect(() => {
    if (!selectedTicket) {
      setMensajes([]);
      return;
    }

    cargarMensajes(selectedTicket.id);

    const channel = supabase
      .channel(`realtime:ticket_mensajes:${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'soporte_mensajes',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Mensaje;
          setMensajes((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedTicket]);

  const mostrarMensaje = (type: 'success' | 'error', text: string) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 4000);
  };

  const cargarTickets = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('soporte_tickets')
        .select(`
          *,
          institucion:instituciones(nombre)
        `);

      if (userRol !== 'superadmin' && userInstId) {
        query = query.eq('institucion_id', userInstId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setTickets((data || []) as Ticket[]);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al cargar tickets');
    } finally {
      setLoading(false);
    }
  };

  const cargarMensajes = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('soporte_mensajes')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensajes(data as Mensaje[]);
    }
  };

  const handleCrearTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitulo || !newDescripcion || !userInstId || !userId) return;
    setCreatingTicket(true);

    try {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('nombre_completo')
        .eq('id', userId)
        .single();

      const { error } = await supabase
        .from('soporte_tickets')
        .insert({
          institucion_id: userInstId,
          usuario_id: userId,
          usuario_nombre: userData?.nombre_completo || userEmail || 'Administrador',
          titulo: newTitulo,
          descripcion: newDescripcion,
          estado: 'abierto',
        });

      if (error) throw error;

      mostrarMensaje('success', 'Ticket creado correctamente.');
      setNewTitulo('');
      setNewDescripcion('');
      setShowNewForm(false);
      cargarTickets();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al crear ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleEnviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !selectedTicket) return;
    setSendingMsg(true);

    // Determine sender name: try public.usuarios first, fallback to email
    let senderName = userEmail || 'Usuario';
    if (userId) {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('nombre_completo')
        .eq('id', userId)
        .maybeSingle();
      if (userData?.nombre_completo) senderName = userData.nombre_completo;
    }
    // Label superadmin clearly so both sides can identify messages
    if (userRol === 'superadmin') senderName = `ChrizDev (${senderName})`;

    try {
      const { error } = await supabase
        .from('soporte_mensajes')
        .insert({
          ticket_id: selectedTicket.id,
          remitente_id: userId ?? null,
          remitente_nombre: senderName,
          contenido: nuevoMensaje.trim(),
        });

      if (error) throw error;
      setNuevoMensaje('');
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al enviar mensaje');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleCambiarEstado = async (nuevoEstado: 'abierto' | 'en_progreso' | 'resuelto') => {
    if (!selectedTicket) return;

    try {
      const { error } = await supabase
        .from('soporte_tickets')
        .update({ estado: nuevoEstado })
        .eq('id', selectedTicket.id);

      if (error) throw error;

      setSelectedTicket((prev) => prev ? { ...prev, estado: nuevoEstado } : null);
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, estado: nuevoEstado } : t))
      );
      mostrarMensaje('success', `Estado del ticket cambiado a ${nuevoEstado.replace('_', ' ')}`);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al cambiar estado');
    }
  };

  if (authLoading || (loading && tickets.length === 0)) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-fade-in ${
          alert.type === 'success' ? 'bg-accent/15 border-accent/30 text-accent-bright' : 'bg-danger/15 border-danger/30 text-danger'
        }`}>
          <span className="text-sm font-medium">{alert.text}</span>
        </div>
      )}

      {/* Header and Create Button for Clients */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Módulo de Soporte Técnico</h2>
          <p className="text-sm text-text-secondary">Canal directo para reportar fallos, dudas o solicitar mejoras</p>
        </div>
        {userRol !== 'superadmin' && (
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="bg-accent hover:bg-accent-bright text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors flex items-center justify-center gap-2 self-start"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {showNewForm ? 'Ver mis Tickets' : 'Nuevo Ticket'}
          </button>
        )}
      </div>

      {showNewForm ? (
        /* Create Ticket Form (Institution Admin View) */
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-xl mx-auto space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-surface-border pb-2">Crear Ticket de Soporte</h3>
          <form onSubmit={handleCrearTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Asunto / Título</label>
              <input
                type="text"
                placeholder="Ej. Error en bitácora de vehículos"
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Descripción del Problema</label>
              <textarea
                placeholder="Por favor, descríbenos en detalle qué error experimentas o qué ayuda necesitas para poder asistirte..."
                value={newDescripcion}
                onChange={(e) => setNewDescripcion(e.target.value)}
                rows={4}
                className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none"
                required
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creatingTicket}
                className="bg-accent hover:bg-accent-bright text-black font-semibold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creatingTicket && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                Enviar Ticket
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Split view: Left Sidebar (Tickets) & Right View (Chat Details) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] items-stretch">
          {/* Left Panel: Tickets List */}
          <div className="bg-surface-card border border-surface-border rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-surface-border">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Historial de Tickets</h3>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
              {tickets.map((ticket) => {
                const isActive = selectedTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left p-4 hover:bg-surface-elevated/20 transition-all flex flex-col gap-2 ${
                      isActive ? 'bg-surface-elevated/40 border-l-2 border-accent' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          ticket.estado === 'abierto'
                            ? 'bg-danger/10 text-danger border-danger/20'
                            : ticket.estado === 'en_progreso'
                            ? 'bg-info/10 text-info border-info/20'
                            : 'bg-accent/15 text-accent-bright border-accent/20'
                        }`}
                      >
                        {ticket.estado === 'en_progreso' ? 'En Progreso' : ticket.estado}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-text-primary line-clamp-1">{ticket.titulo}</p>
                    {userRol === 'superadmin' && (
                      <p className="text-[10px] text-accent-bright font-mono">
                        Cliente: {ticket.institucion?.nombre || 'Desconocido'}
                      </p>
                    )}
                  </button>
                );
              })}
              {tickets.length === 0 && (
                <div className="p-6 text-center text-xs text-text-muted">
                  No hay tickets de soporte registrados.
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Chat Container */}
          <div className="lg:col-span-2 bg-surface-card border border-surface-border rounded-2xl flex flex-col overflow-hidden">
            {selectedTicket ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-elevated/20">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-accent-bright uppercase tracking-wider font-mono">Ticket #{selectedTicket.id.slice(0, 8)}</h3>
                    <p className="text-sm font-semibold text-text-primary line-clamp-1 mt-0.5">{selectedTicket.titulo}</p>
                    {userRol === 'superadmin' && (
                      <p className="text-2xs text-text-secondary mt-0.5">
                        Institución: <strong>{selectedTicket.institucion?.nombre}</strong> | Remitente: <strong>{selectedTicket.usuario_nombre}</strong>
                      </p>
                    )}
                  </div>
                  {/* Super Admin Status controls */}
                  {userRol === 'superadmin' ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTicket.estado}
                        onChange={(e) => handleCambiarEstado(e.target.value as any)}
                        className="bg-surface border border-surface-border rounded-xl px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent/50 font-semibold"
                      >
                        <option value="abierto">Abierto</option>
                        <option value="en_progreso">En Progreso</option>
                        <option value="resuelto">Resuelto</option>
                      </select>
                    </div>
                  ) : (
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                        selectedTicket.estado === 'abierto'
                          ? 'bg-danger/15 text-danger'
                          : selectedTicket.estado === 'en_progreso'
                          ? 'bg-info/15 text-info'
                          : 'bg-accent/15 text-accent-bright'
                      }`}
                    >
                      {selectedTicket.estado === 'en_progreso' ? 'En Progreso' : selectedTicket.estado}
                    </span>
                  )}
                </div>

                {/* Asunto/Descripción details */}
                <div className="p-4 bg-surface/50 border-b border-surface-border">
                  <p className="text-2xs text-text-muted uppercase tracking-wider font-bold">Descripción original:</p>
                  <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{selectedTicket.descripcion}</p>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface/30">
                  {mensajes.map((msg) => {
                    // isOwn: match by ID if available, or by checking if the name starts with 'ChrizDev' for superadmin
                    const isOwn = (userId && msg.remitente_id === userId) ||
                      (userRol === 'superadmin' && msg.remitente_nombre.startsWith('ChrizDev')) ||
                      (userRol !== 'superadmin' && userId && msg.remitente_id === userId);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[80%] ${isOwn ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-semibold text-text-secondary">
                            {msg.remitente_nombre}
                          </span>
                          <span className="text-[9px] text-text-muted">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-2 text-xs border ${
                            isOwn
                              ? 'bg-accent/15 border-accent/20 text-text-primary rounded-tr-none'
                              : 'bg-surface-elevated border-surface-border text-text-primary rounded-tl-none'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleEnviarMensaje} className="p-3 border-t border-surface-border flex gap-2 bg-surface-elevated/10">
                  <input
                    type="text"
                    placeholder={selectedTicket.estado === 'resuelto' ? "El ticket está resuelto. Escribe para reabrir..." : "Escribe un mensaje para soporte..."}
                    value={nuevoMensaje}
                    onChange={(e) => setNuevoMensaje(e.target.value)}
                    className="flex-1 bg-surface border border-surface-border rounded-xl px-4 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                    required
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg}
                    className="bg-accent hover:bg-accent-bright text-black font-semibold px-4 py-2 rounded-xl text-xs transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {sendingMsg ? '...' : 'Enviar'}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-16 h-16 bg-surface-elevated border border-surface-border rounded-full flex items-center justify-center text-text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Detalles del Ticket</h3>
                <p className="text-xs text-text-secondary max-w-xs">Selecciona un ticket de soporte de la lista izquierda para cargar la conversación o ver los detalles.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
