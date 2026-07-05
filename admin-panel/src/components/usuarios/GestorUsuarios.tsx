import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Usuario {
  id: string;
  nombre_completo: string;
  email: string;
  rol: string;
  activo: boolean;
  telefono: string | null;
  documento: string | null;
  observaciones_admin: string | null;
  dias_laborales: string[] | null;
  created_at: string;
}

interface Turno {
  id: string;
  inicio_turno: string;
  fin_turno: string | null;
  motivo_cierre_anticipado: string | null;
  motivo_entrada_tarde: string | null;
}

const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function parseDiasLaborales(dias: string[] | null) {
  const result: Record<string, { active: boolean; start: string; end: string }> = {};
  diasSemana.forEach(d => {
    result[d] = { active: false, start: '06:00', end: '18:00' };
  });
  if (dias) {
    dias.forEach(item => {
      const parts = item.split('|');
      const dayName = parts[0].toLowerCase();
      if (result[dayName]) {
        result[dayName].active = true;
        if (parts[1]) result[dayName].start = parts[1];
        if (parts[2]) result[dayName].end = parts[2];
      }
    });
  }
  return result;
}

export default function GestorUsuarios() {
  const { user, institucionId, userRol, loading: authLoading } = useSession();
  const userId = user?.id;

  // List states
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form states for New Employee
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('vigilante');
  const [diasLaborales, setDiasLaborales] = useState<string[]>(
    diasSemana.map(d => `${d}|06:00|18:00`)
  );
  const [creating, setCreating] = useState(false);

  // Modal states for Shifts History
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(false);

  // Edit Observations state
  const [editingObsUser, setEditingObsUser] = useState<Usuario | null>(null);
  const [tempObs, setTempObs] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  // General Toast message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password visible toggle
  const [showPass, setShowPass] = useState(false);

  // Modal states for Novelties (Novedades)
  const [novedadUser, setNovedadUser] = useState<Usuario | null>(null);
  const [novTipo, setNovTipo] = useState('cita medica');
  const [novDetalle, setNovDetalle] = useState('');
  const [novEvidencia, setNovEvidencia] = useState<File | null>(null);
  const [novTieneEvidencia, setNovTieneEvidencia] = useState(false);
  const [subiendoNovedad, setSubiendoNovedad] = useState(false);

  // Modal states for Editing Shifts (Turnos)
  const [editTurnoUser, setEditTurnoUser] = useState<Usuario | null>(null);
  const [editDiasLaborales, setEditDiasLaborales] = useState<string[]>([]);
  const [guardandoTurno, setGuardandoTurno] = useState(false);

  const handleToggleDay = (d: string) => {
    setDiasLaborales((prev) => {
      const active = prev.some(item => item.startsWith(d));
      if (active) {
        return prev.filter(item => !item.startsWith(d));
      } else {
        return [...prev, `${d}|06:00|18:00`];
      }
    });
  };

  const handleUpdateHour = (d: string, field: 'start' | 'end', value: string) => {
    setDiasLaborales(prev => {
      const index = prev.findIndex(item => item.startsWith(d));
      if (index === -1) return prev;
      const parts = prev[index].split('|');
      const start = field === 'start' ? value : (parts[1] || '06:00');
      const end = field === 'end' ? value : (parts[2] || '18:00');
      const updated = [...prev];
      updated[index] = `${d}|${start}|${end}`;
      return updated;
    });
  };

  const handleUpdateEditHour = (d: string, field: 'start' | 'end', value: string) => {
    setEditDiasLaborales(prev => {
      const index = prev.findIndex(item => item.startsWith(d));
      if (index === -1) return prev;
      const parts = prev[index].split('|');
      const start = field === 'start' ? value : (parts[1] || '06:00');
      const end = field === 'end' ? value : (parts[2] || '18:00');
      const updated = [...prev];
      updated[index] = `${d}|${start}|${end}`;
      return updated;
    });
  };

  useEffect(() => {
    if (!institucionId) {
      setLoading(false);
      return;
    }
    cargarUsuarios();
  }, [institucionId]);

  const cargarUsuarios = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('usuarios')
      .select('id,nombre_completo,email,rol,activo,telefono,documento,observaciones_admin,dias_laborales,created_at')
      .eq('institucion_id', institucionId)
      .neq('rol', 'superadmin')
      .order('created_at', { ascending: false });

    if (data) setUsuarios(data as Usuario[]);
    setLoading(false);
  };

  const mostrarMensaje = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const toggleActivo = async (usuario: Usuario) => {
    try {
      const { error } = await supabase.from('usuarios').update({ activo: !usuario.activo }).eq('id', usuario.id);
      if (error) throw error;

      if (institucionId) {
        await supabase.from('logs_auditoria').insert({
          institucion_id: institucionId,
          actor_nombre: 'Administrador',
          actor_rol: 'admin_institucion',
          accion: !usuario.activo ? 'Activar Usuario' : 'Desactivar Usuario',
          detalles: `Se cambió el estado del usuario "${usuario.nombre_completo}" (${usuario.email}) a ${!usuario.activo ? 'activo' : 'inactivo'}`
        });
      }

      setUsuarios((prev) => prev.map((u) => u.id === usuario.id ? { ...u, activo: !u.activo } : u));
      mostrarMensaje('success', `Estado del usuario actualizado.`);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al cambiar estado.');
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institucionId || !nombre || !email || !password || !documento) return;
    setCreating(true);

    try {
      // 1. Create auth user via server-side API (uses service_role, avoids auth schema permission errors)
      const res = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          institucion_id: institucionId,
          nombre_completo: nombre,
          rol,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear el usuario.');

      const newUserId = result.id;

      // 2. Update extended profile attributes (telefono, documento, dias_laborales)
      if (newUserId) {
        const { error: updErr } = await supabase
          .from('usuarios')
          .update({
            telefono: telefono || null,
            documento: documento,
            dias_laborales: diasLaborales
          })
          .eq('id', newUserId);

        if (updErr) throw updErr;

        await supabase.from('logs_auditoria').insert({
          institucion_id: institucionId,
          actor_nombre: 'Administrador',
          actor_rol: 'admin_institucion',
          accion: 'Contratar Personal',
          detalles: `Se registró el usuario "${nombre}" con email "${email}" y rol "${rol}"`
        });
      }

      mostrarMensaje('success', `Usuario "${nombre}" creado con éxito.`);
      setNombre('');
      setDocumento('');
      setTelefono('');
      setEmail('');
      setPassword('');
      setRol('vigilante');
      setDiasLaborales(diasSemana.map(d => `${d}|06:00|18:00`));
      cargarUsuarios();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al crear el usuario.');
    } finally {
      setCreating(false);
    }
  };

  // 4. Registrar Novedad (Vigilante action)
  const handleRegistrarNovedad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novedadUser || !novDetalle || !institucionId) return;
    setSubiendoNovedad(true);

    try {
      let evidenciaUrl = null;

      if (novTieneEvidencia && novEvidencia) {
        const fileExt = novEvidencia.name.split('.').pop();
        const fileName = `${novedadUser.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('evidencias')
          .upload(fileName, novEvidencia);

        if (uploadErr) throw uploadErr;
        
        const { data: { publicUrl } } = supabase.storage
          .from('evidencias')
          .getPublicUrl(fileName);
          
        evidenciaUrl = publicUrl;
      }

      const { error } = await supabase.from('novedades').insert({
        institucion_id: institucionId,
        vigilante_id: novedadUser.id,
        creador_id: userId,
        titulo: novTipo.toUpperCase(),
        descripcion: novDetalle,
        evidencia_url: evidenciaUrl,
      });

      if (error) throw error;

      await supabase.from('logs_auditoria').insert({
        institucion_id: institucionId,
        actor_nombre: 'Administrador',
        actor_rol: 'admin_institucion',
        accion: 'Reporte de Novedad',
        detalles: `Se registró novedad de tipo "${novTipo}" para el vigilante "${novedadUser.nombre_completo}". Detalle: "${novDetalle}"`
      });

      mostrarMensaje('success', 'Novedad registrada con éxito.');
      setNovedadUser(null);
      setNovDetalle('');
      setNovEvidencia(null);
      setNovTieneEvidencia(false);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al registrar la novedad.');
    } finally {
      setSubiendoNovedad(false);
    }
  };

  // 5. Guardar Turno (Vigilante Shift edit)
  const handleGuardarTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTurnoUser || !institucionId) return;
    setGuardandoTurno(true);

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ dias_laborales: editDiasLaborales })
        .eq('id', editTurnoUser.id);

      if (error) throw error;

      await supabase.from('logs_auditoria').insert({
        institucion_id: institucionId,
        actor_nombre: 'Administrador',
        actor_rol: 'admin_institucion',
        accion: 'Modificación de Turno',
        detalles: `Se modificaron los días laborales de "${editTurnoUser.nombre_completo}" a: ${editDiasLaborales.join(', ')}`
      });

      mostrarMensaje('success', 'Turnos actualizados con éxito.');
      setEditTurnoUser(null);
      cargarUsuarios();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al guardar el turno.');
    } finally {
      setGuardandoTurno(false);
    }
  };

  // 6. Compartir desglose semanal de turnos por WhatsApp
  const handleCompartirHorarios = (u: Usuario) => {
    const parsed = parseDiasLaborales(u.dias_laborales);
    const diasDetalle = diasSemana
      .filter(d => parsed[d].active)
      .map(d => `• ${d.charAt(0).toUpperCase() + d.slice(1)}: ${parsed[d].start} - ${parsed[d].end}`)
      .join('\n');
    
    const texto = `*VIGIA - Horario de Turnos*\n\nHola ${u.nombre_completo},\naquí tienes el desglose de tus turnos asignados:\n\n${diasDetalle || 'Sin turnos asignados esta semana.'}\n\nPor favor reporta cualquier novedad con anticipación.`;
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  // Turnos Modal
  const openTurnosModal = async (u: Usuario) => {
    setSelectedUser(u);
    setLoadingTurnos(true);
    const { data } = await supabase
      .from('turnos')
      .select('id,inicio_turno,fin_turno,motivo_cierre_anticipado,motivo_entrada_tarde')
      .eq('vigilante_id', u.id)
      .order('inicio_turno', { ascending: false })
      .limit(10);

    if (data) setTurnos(data as Turno[]);
    setLoadingTurnos(false);
  };

  // Observations Modal
  const openObsModal = (u: Usuario) => {
    setEditingObsUser(u);
    setTempObs(u.observaciones_admin ?? '');
  };

  const saveObservaciones = async () => {
    if (!editingObsUser) return;
    setSavingObs(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ observaciones_admin: tempObs.trim() || null })
        .eq('id', editingObsUser.id);

      if (error) throw error;
      setUsuarios((prev) =>
        prev.map((u) => (u.id === editingObsUser.id ? { ...u, observaciones_admin: tempObs.trim() || null } : u))
      );
      mostrarMensaje('success', 'Observaciones guardadas con éxito.');
      setEditingObsUser(null);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al guardar observaciones.');
    } finally {
      setSavingObs(false);
    }
  };

  const formatedDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const rolBadge = (rol: string) => {
    const map: Record<string, string> = {
      superadmin: 'bg-warning/15 text-warning border border-warning/30',
      admin_institucion: 'bg-info/15 text-info border border-info/30',
      vigilante: 'bg-accent/15 text-accent-bright border border-accent/30',
    };
    const labels: Record<string, string> = {
      superadmin: 'Superadmin',
      admin_institucion: 'Admin',
      vigilante: 'Vigilante',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${map[rol] || ''}`}>
        {labels[rol] || rol}
      </span>
    );
  };

  if (authLoading || (loading && usuarios.length === 0)) return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const filtrados = usuarios.filter((u) => {
    const q = search.toLowerCase();
    return u.nombre_completo.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.documento && u.documento.includes(q)) ||
      (u.telefono && u.telefono.includes(q));
  });

  const puedeEditar = userRol === 'superadmin' || userRol === 'admin_institucion';

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-fade-in ${
          message.type === 'success' ? 'bg-accent/15 border-accent/30 text-accent-bright' : 'bg-danger/15 border-danger/30 text-danger'
        }`}>
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Users List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-surface-border flex flex-col md:flex-row gap-4 items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Vigilantes y Operarios</h3>
              <div className="relative max-w-xs w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nombre, documento, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl pl-9 pr-4 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-surface-border text-xs text-text-muted uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Nombre / Datos</th>
                    <th className="text-left px-5 py-3 font-medium">Contacto</th>
                    <th className="text-left px-5 py-3 font-medium">Rol</th>
                    <th className="text-left px-5 py-3 font-medium">Programación Semanal</th>
                    <th className="text-left px-5 py-3 font-medium">Estado</th>
                    <th className="text-center px-5 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filtrados.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{u.nombre_completo}</p>
                          <p className="text-2xs text-text-muted font-mono mt-0.5">Doc: {u.documento || 'No registra'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-xs text-text-secondary">{u.email}</p>
                          <p className="text-2xs text-text-muted mt-0.5">Tel: {u.telefono || 'No registra'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">{rolBadge(u.rol)}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1 flex-wrap max-w-[220px]">
                          {(() => {
                            const parsed = parseDiasLaborales(u.dias_laborales);
                            return diasSemana.map((day) => {
                              const info = parsed[day];
                              return (
                                <span
                                  key={day}
                                  title={info.active ? `${day}: ${info.start} a ${info.end}` : `${day}: No asignado`}
                                  className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border flex flex-col items-center justify-center transition-all ${
                                    info.active
                                      ? 'bg-accent/10 border-accent/30 text-accent-bright'
                                      : 'bg-surface border-surface-border text-text-muted opacity-60'
                                  }`}
                                >
                                  <span className="capitalize">{day.substring(0, 2)}</span>
                                  {info.active && <span className="text-[7px] text-text-muted mt-0.5">{info.start}-{info.end}</span>}
                                </span>
                              );
                            });
                          })()}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.activo ? 'text-accent-bright' : 'text-text-muted'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-accent' : 'bg-text-muted'}`} />
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openObsModal(u)}
                            title="Observaciones"
                            className="bg-surface border border-surface-border hover:bg-surface-elevated text-text-secondary p-1.5 rounded-lg transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openTurnosModal(u)}
                            title="Ver Historial de Turnos"
                            className="bg-surface border border-surface-border hover:bg-surface-elevated text-text-secondary p-1.5 rounded-lg transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {puedeEditar && u.rol === 'vigilante' && (
                            <button
                              onClick={() => setNovedadUser(u)}
                              title="Registrar Novedad"
                              className="bg-surface border border-surface-border hover:bg-surface-elevated text-warning hover:border-warning/40 p-1.5 rounded-lg transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </button>
                          )}
                          {puedeEditar && u.rol === 'vigilante' && (
                            <button
                              onClick={() => { setEditTurnoUser(u); setEditDiasLaborales(u.dias_laborales || []); }}
                              title="Editar Turnos"
                              className="bg-surface border border-surface-border hover:bg-surface-elevated text-accent-bright hover:border-accent/40 p-1.5 rounded-lg transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                          {u.rol === 'vigilante' && (
                            <button
                              onClick={() => handleCompartirHorarios(u)}
                              title="Enviar Horarios (WhatsApp)"
                              className="bg-surface border border-surface-border hover:bg-surface-elevated text-green-500 hover:border-green-500/40 p-1.5 rounded-lg transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.793 1.452 5.485.002 9.947-4.461 9.95-9.95.002-2.658-1.03-5.158-2.903-7.03C16.518 1.751 14.024.72 11.365.719 5.882.719 1.419 5.181 1.416 10.669c-.002 1.677.444 3.313 1.293 4.757l-.963 3.518 3.606-.946zm11.45-6.78c-.265-.133-1.57-.775-1.812-.862-.243-.088-.42-.132-.596.132-.176.265-.682.862-.837 1.04-.155.176-.31.198-.574.065-.264-.132-1.114-.41-2.122-1.31-.784-.7-1.314-1.564-1.468-1.829-.154-.264-.016-.407.116-.54.12-.12.264-.309.396-.463.132-.154.176-.264.264-.44.088-.177.044-.33-.022-.463-.066-.133-.596-1.433-.816-1.963-.214-.518-.448-.448-.613-.456-.16-.008-.343-.01-.527-.01-.184 0-.485.07-.74.352-.254.282-.97.948-.97 2.31 0 1.362.99 2.678 1.13 2.855.14.176 1.948 2.974 4.72 4.17.659.284 1.174.453 1.576.581.662.21 1.265.18 1.742.109.531-.08 1.57-.64 1.791-1.258.22-.617.22-1.146.154-1.258-.066-.11-.243-.176-.507-.308z"/>
                              </svg>
                            </button>
                          )}
                          {puedeEditar && (
                            <button
                              onClick={() => toggleActivo(u)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                                u.activo
                                  ? 'bg-danger/10 text-danger hover:bg-danger/20'
                                  : 'bg-accent/15 text-accent-bright hover:bg-accent/25'
                              }`}
                            >
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-sm text-text-muted">No se encontraron vigilantes registrados</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Creation Form */}
        <div className="space-y-6">
          {puedeEditar && (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-surface-border pb-2">Contratar Vigilante / Admin</h3>
              <form onSubmit={handleCrearUsuario} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    placeholder="Ej. Carlos Mendoza"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Cédula o Identificación</label>
                  <input
                    type="text"
                    placeholder="Ej. 102345678"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Número Celular / Teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej. 3123456789"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="ejemplo@vigia.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Contraseña de Acceso</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-surface border border-surface-border rounded-xl pl-3.5 pr-10 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                      {showPass ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Rol</label>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  >
                    <option value="vigilante">Vigilante / Operador de Acceso</option>
                    <option value="admin_institucion">Administrador local (Admin Empresa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2">Días Laborales Asignados y Horario</label>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {diasSemana.map((d) => {
                      const item = diasLaborales.find(x => x.startsWith(d));
                      const active = !!item;
                      const parts = item ? item.split('|') : [];
                      const start = parts[1] || '06:00';
                      const end = parts[2] || '18:00';
                      return (
                        <div key={d} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-surface rounded-xl border border-surface-border">
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary capitalize cursor-pointer">
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => handleToggleDay(d)}
                              className="accent-accent"
                            />
                            {d}
                          </label>
                          {active && (
                            <div className="flex items-center gap-1.5 ml-6 sm:ml-0">
                              <input
                                type="time"
                                value={start}
                                onChange={(e) => handleUpdateHour(d, 'start', e.target.value)}
                                className="bg-surface-elevated border border-surface-border text-text-primary text-[10px] rounded-lg p-1 focus:outline-none focus:border-accent"
                              />
                              <span className="text-text-muted text-[10px]">a</span>
                              <input
                                type="time"
                                value={end}
                                onChange={(e) => handleUpdateHour(d, 'end', e.target.value)}
                                className="bg-surface-elevated border border-surface-border text-text-primary text-[10px] rounded-lg p-1 focus:outline-none focus:border-accent"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl py-2 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  {creating ? 'Guardando...' : 'Contratar Empleado'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Observaciones */}
      {editingObsUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-md font-bold text-text-primary">Observaciones de Vigilante</h3>
              <p className="text-xs text-text-secondary">Deja anotaciones sobre el vigilante {editingObsUser.nombre_completo}.</p>
            </div>
            <textarea
              rows={4}
              placeholder="Escribe observaciones, sanciones, anotaciones de turno..."
              value={tempObs}
              onChange={(e) => setTempObs(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-xl p-3 text-sm text-text-primary focus:outline-none focus:border-accent/50"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingObsUser(null)}
                className="bg-surface hover:bg-surface-elevated border border-surface-border text-text-secondary px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={saveObservaciones}
                disabled={savingObs}
                className="bg-accent hover:bg-accent-bright text-black px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingObs && <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Historial de Turnos */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-surface-border pb-3">
              <div>
                <h3 className="text-md font-bold text-text-primary">Historial de Turnos</h3>
                <p className="text-xs text-text-secondary">Últimos registros de entrada/salida de {selectedUser.nombre_completo}.</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-text-muted hover:text-text-primary text-sm font-semibold p-1"
              >
                Cerrar
              </button>
            </div>

            {loadingTurnos ? (
              <div className="py-8 flex justify-center"><span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {turnos.map((t) => {
                  const inicio = new Date(t.inicio_turno);
                  const fin = t.fin_turno ? new Date(t.fin_turno) : null;
                  let duracionStr = 'En curso';
                  if (fin) {
                    const diffMs = fin.getTime() - inicio.getTime();
                    const diffHrs = Math.floor(diffMs / 3600000);
                    const diffMins = Math.floor((diffMs % 3600000) / 60000);
                    duracionStr = `${diffHrs}h ${diffMins}m`;
                  }

                  return (
                    <div key={t.id} className="bg-surface border border-surface-border p-3.5 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-text-primary font-bold">
                            {inicio.toLocaleDateString('es-CO')}
                          </p>
                          <p className="text-2xs text-text-muted mt-0.5 font-mono">
                            Inicio: {inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            {fin && ` | Fin: ${fin.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                        </div>
                        <span className={`text-2xs font-semibold px-2.5 py-1 rounded-full ${
                          fin ? 'bg-surface-elevated text-text-secondary border border-surface-border' : 'bg-accent/15 text-accent-bright border border-accent/30'
                        }`}>
                          {duracionStr}
                        </span>
                      </div>

                      {t.motivo_entrada_tarde && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-2xs text-amber-300">
                          <strong className="uppercase font-bold tracking-wider mr-1 text-[9px] text-amber-400">Llegada Tarde:</strong>
                          {t.motivo_entrada_tarde}
                        </div>
                      )}

                      {t.motivo_cierre_anticipado && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-2xs text-red-300">
                          <strong className="uppercase font-bold tracking-wider mr-1 text-[9px] text-red-400">Salida Anticipada:</strong>
                          {t.motivo_cierre_anticipado}
                        </div>
                      )}
                    </div>
                  );
                })}
                {turnos.length === 0 && (
                  <p className="text-center py-6 text-xs text-text-muted">No se registran marcas de turno.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Registrar Novedad */}
      {novedadUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRegistrarNovedad} className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-md font-bold text-text-primary">Registrar Novedad</h3>
              <p className="text-xs text-text-secondary">Reportar novedad para el vigilante {novedadUser.nombre_completo}.</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de Novedad</label>
              <select
                value={novTipo}
                onChange={(e) => setNovTipo(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
              >
                <option value="cita medica">Cita Médica</option>
                <option value="asuntos personales">Asuntos Personales</option>
                <option value="llega tarde">Llega Tarde</option>
                <option value="no llego">No Llegó</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Detalles / Explicación</label>
              <textarea
                rows={3}
                placeholder="Escribe el motivo o explicación detallada..."
                value={novDetalle}
                onChange={(e) => setNovDetalle(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl p-3 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tiene-evidencia"
                checked={novTieneEvidencia}
                onChange={(e) => setNovTieneEvidencia(e.target.checked)}
                className="accent-accent cursor-pointer"
              />
              <label htmlFor="tiene-evidencia" className="text-xs text-text-secondary cursor-pointer">
                ¿Presenta evidencia física / soporte multimedia?
              </label>
            </div>

            {novTieneEvidencia && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Archivo de Soporte (Evidencia)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setNovEvidencia(file);
                  }}
                  className="w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-black hover:file:bg-accent-bright file:cursor-pointer"
                  required={novTieneEvidencia}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setNovedadUser(null);
                  setNovDetalle('');
                  setNovEvidencia(null);
                  setNovTieneEvidencia(false);
                }}
                className="bg-surface hover:bg-surface-elevated border border-surface-border text-text-secondary px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={subiendoNovedad}
                className="bg-accent hover:bg-accent-bright text-black px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                {subiendoNovedad && <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                Enviar Reporte
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Turnos (Días laborales) */}
      {editTurnoUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleGuardarTurno} className="bg-surface-card border border-surface-border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-surface-border pb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent-bright">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-md font-bold text-text-primary">Programación de Turnos y Horarios</h3>
                <p className="text-xs text-text-secondary">Asigna los días y rangos de horas laborales para <strong className="text-text-primary">{editTurnoUser.nombre_completo}</strong>.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 py-1">
              {diasSemana.map((d) => {
                const item = editDiasLaborales.find(x => x.startsWith(d));
                const active = !!item;
                const parts = item ? item.split('|') : [];
                const start = parts[1] || '06:00';
                const end = parts[2] || '18:00';
                return (
                  <div key={d} className={`flex flex-col justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    active ? 'bg-surface-elevated/20 border-accent/30' : 'bg-surface border-surface-border'
                  }`}>
                    <label className="flex items-center gap-2.5 text-xs font-bold text-text-primary capitalize cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          setEditDiasLaborales((prev) => {
                            const isAct = prev.some(x => x.startsWith(d));
                            if (isAct) {
                              return prev.filter(x => !x.startsWith(d));
                            } else {
                              return [...prev, `${d}|06:00|18:00`];
                            }
                          });
                        }}
                        className="w-4 h-4 rounded accent-accent bg-surface border-surface-border focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      {d}
                    </label>
                    {active && (
                      <div className="flex items-center gap-2 pl-6">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-text-muted mb-1 font-semibold uppercase tracking-wider">Entrada</span>
                          <input
                            type="time"
                            value={start}
                            onChange={(e) => handleUpdateEditHour(d, 'start', e.target.value)}
                            className="bg-surface-elevated border border-surface-border text-text-primary text-xs font-bold rounded-lg p-2 focus:outline-none focus:border-accent w-28 text-center font-mono"
                          />
                        </div>
                        <span className="text-text-muted text-xs font-bold mt-4">a</span>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-text-muted mb-1 font-semibold uppercase tracking-wider">Salida</span>
                          <input
                            type="time"
                            value={end}
                            onChange={(e) => handleUpdateEditHour(d, 'end', e.target.value)}
                            className="bg-surface-elevated border border-surface-border text-text-primary text-xs font-bold rounded-lg p-2 focus:outline-none focus:border-accent w-28 text-center font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setEditTurnoUser(null)}
                className="bg-surface hover:bg-surface-elevated border border-surface-border text-text-secondary px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoTurno}
                className="bg-accent hover:bg-accent-bright text-black px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-md shadow-accent/15"
              >
                {guardandoTurno && <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
