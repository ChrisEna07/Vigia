import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Institucion {
  id: string;
  nombre: string;
  slug: string;
  plan_suscripcion: string;
  monto_mensual: number;
  fecha_vencimiento: string;
  estado_suscripcion: string;
  activa: boolean;
  en_demo?: boolean;
}

interface SuperAdminLog {
  id: string;
  empresa_nombre: string;
  accion: string;
  monto: number;
  tipo_plan: string;
  detalles: string;
  created_at: string;
}

interface Props {
  instituciones: Institucion[];
  wiping: boolean;
  handleWipeTotal: () => Promise<void>;
}

export default function DashboardSuperAdmin({ instituciones, wiping, handleWipeTotal }: Props) {
  const [logs, setLogs] = useState<SuperAdminLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Anuncios states
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [loadingAnuncios, setLoadingAnuncios] = useState(false);
  const [anuncioTitulo, setAnuncioTitulo] = useState('');
  const [anuncioDesc, setAnuncioDesc] = useState('');
  const [anuncioTipo, setAnuncioTipo] = useState('ambos');
  const [anuncioFechaFin, setAnuncioFechaFin] = useState('');

  // Offline states
  const [isOffline, setIsOffline] = useState(false);
  const [offlineNombre, setOfflineNombre] = useState('');
  const [offlineEmail, setOfflineEmail] = useState('');
  const [offlinePassword, setOfflinePassword] = useState('');

  const mostrarMensaje = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4500);
  };

  // Search and filter states for logs
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Business invite states
  const [queryEmpresa, setQueryEmpresa] = useState('');
  const [inviteEmpresa, setInviteEmpresa] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePlan, setInvitePlan] = useState('vigia-pro');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [customMsg, setCustomMsg] = useState('');

  useEffect(() => {
    setCustomMsg(
      `Hola equipo de ${inviteEmpresa || '[Empresa]'},\n\n` +
      `Es un placer saludarlos. Nos ponemos en contacto desde VIGIA, la plataforma táctica líder en control de accesos perimetrales y bitácora de personal.\n\n` +
      `Queremos ofrecerles una PRUEBA DEMO GRATUITA DE 20 DÍAS con todas las funciones desbloqueadas (registro de ingresos, seriales de portátiles, vehículos y mensajería en vivo).\n\n` +
      `Nuestros planes comerciales adaptados a su necesidad:\n` +
      `1. Plan Básico: Acceso Web, Monitoreo local y reportes en tiempo real. ($1.000.000 COP únicos + $250.000 COP mensual por servicio Cloud).\n` +
      `2. Plan Vigia Pro: Acceso Web + App Móvil Completa, Gestión de accesos, Novedades, Horarios y Soporte. ($1.500.000 COP únicos + $350.000 COP mensual por servicio Cloud).\n` +
      `3. Plan Vigia Offline: Acceso Web Local con Base de Datos local. ($650.000 COP únicos sin costos mensuales de nube).\n\n` +
      `Pueden responder a este mensaje o contactarnos vía WhatsApp o llamada al número directo del propietario 3183517802 para coordinar la activación de sus credenciales demo hoy mismo.\n\n` +
      `Atentamente,\n` +
      `Gerencia Comercial VIGIA`
    );
  }, [inviteEmpresa]);

  useEffect(() => {
    cargarLogs();
    cargarAnuncios();
    if (typeof window !== 'undefined') {
      setIsOffline(localStorage.getItem('vigia_offline_session') !== null);
    }
  }, []);

  const handleCrearClienteOffline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineNombre || !offlineEmail || !offlinePassword) {
      mostrarMensaje('error', 'Por favor completa todos los campos.');
      return;
    }

    try {
      const offlineUsersRaw = localStorage.getItem('vigia_offline_users');
      const offlineUsers = offlineUsersRaw ? JSON.parse(offlineUsersRaw) : [];

      if (offlineUsers.some((u: any) => u.email.toLowerCase() === offlineEmail.toLowerCase())) {
        mostrarMensaje('error', 'Ya existe un usuario offline con este correo electrónico.');
        return;
      }

      const newUser = {
        id: 'offline-user-' + Date.now(),
        email: offlineEmail,
        password: offlinePassword,
        rol: 'admin_institucion',
        institucion_id: 'offline-inst-' + Date.now(),
        nombre: offlineNombre
      };

      offlineUsers.push(newUser);
      localStorage.setItem('vigia_offline_users', JSON.stringify(offlineUsers));

      mostrarMensaje('success', `¡Cliente offline "${offlineNombre}" creado con éxito!`);
      setOfflineNombre('');
      setOfflineEmail('');
      setOfflinePassword('');
    } catch (err: any) {
      mostrarMensaje('error', 'Error al crear cliente offline: ' + err.message);
    }
  };

  const cargarAnuncios = async () => {
    setLoadingAnuncios(true);
    try {
      const { data } = await supabase
        .from('anuncios')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setAnuncios(data);
    } catch (err) {
      console.error('Error loading announcements:', err);
    }
    setLoadingAnuncios(false);
  };

  const handleCrearAnuncio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anuncioTitulo || !anuncioDesc || !anuncioFechaFin) return;

    try {
      const { error } = await supabase.from('anuncios').insert({
        titulo: anuncioTitulo,
        descripcion: anuncioDesc,
        tipo: anuncioTipo,
        fecha_fin: new Date(anuncioFechaFin).toISOString(),
      });

      if (error) throw error;

      mostrarMensaje('success', 'Anuncio de actualización publicado con éxito.');
      setAnuncioTitulo('');
      setAnuncioDesc('');
      setAnuncioTipo('ambos');
      setAnuncioFechaFin('');
      cargarAnuncios();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al publicar anuncio.');
    }
  };

  const handleEliminarAnuncio = async (id: string) => {
    try {
      const { error } = await supabase.from('anuncios').delete().eq('id', id);
      if (error) throw error;
      mostrarMensaje('success', 'Anuncio eliminado.');
      cargarAnuncios();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al eliminar anuncio.');
    }
  };

  const cargarLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data } = await supabase
        .from('logs_superadmin')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setLogs(data as SuperAdminLog[]);
    } catch (err) {
      console.error('Error loading superadmin logs:', err);
    }
    setLoadingLogs(false);
  };

  // Log custom invitation and submit to db
  const registrarInvitacionLog = async (canal: string) => {
    try {
      await supabase.from('logs_superadmin').insert({
        empresa_nombre: inviteEmpresa,
        accion: 'invitacion_enviada',
        tipo_plan: 'basico', // fallback plan string required by database
        monto: 0,
        detalles: `Invitación enviada a "${inviteEmpresa}" (${inviteEmail || 'sin correo'}) vía ${canal}.`
      });
      cargarLogs();
    } catch (err) {
      console.error('Error logging invitation:', err);
    }
  };

  const handleEnviarEmail = () => {
    if (!inviteEmail || !inviteEmpresa) {
      mostrarMensaje('error', 'Por favor ingresa el nombre de la empresa y correo electrónico.');
      return;
    }
    const subject = `Propuesta Comercial Vigia - Demo 20 Días - ${inviteEmpresa}`;
    window.open(`mailto:${inviteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(customMsg)}`, '_blank');
    registrarInvitacionLog('Email');
    mostrarMensaje('success', `Invitación de email abierta. Log registrado para ${inviteEmpresa}.`);
  };

  const handleEnviarWhatsapp = () => {
    if (!inviteEmpresa) {
      mostrarMensaje('error', 'Por favor ingresa el nombre de la empresa.');
      return;
    }
    // Open WhatsApp Chat to the owner's WhatsApp number with pre-filled message text
    window.open(`https://wa.me/573183517802?text=${encodeURIComponent(customMsg)}`, '_blank');
    registrarInvitacionLog('WhatsApp');
    mostrarMensaje('success', `WhatsApp abierto. Log registrado para ${inviteEmpresa}.`);
  };

  const handleGoogleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = queryEmpresa.trim() || 'empresas de seguridad privada Colombia';
    // Use Google search with &igu=1 which is designed to bypass frame block/CSP in browsers
    setIframeUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`);
  };

  // Metrics Calculations
  const totalClientes = instituciones.length;
  const activos = instituciones.filter(i => i.estado_suscripcion === 'activa' && i.activa && !i.en_demo).length;
  const demos = instituciones.filter(i => i.en_demo && i.activa).length;
  const vencidos = instituciones.filter(i => i.estado_suscripcion === 'vencida' || !i.activa).length;

  // Billing potential (all paid monthly subscription fees)
  const ingresoTotal = instituciones.reduce((acc, curr) => acc + Number(curr.monto_mensual || 0), 0);

  // Gross Income (sum of active, paid, non-demo subscriptions)
  const ingresoBruto = instituciones
    .filter(i => i.estado_suscripcion === 'activa' && i.activa && !i.en_demo)
    .reduce((acc, curr) => acc + Number(curr.monto_mensual || 0), 0);

  // Net earnings (deduct 15% platform and SMS/cloud expenses)
  const gananciasReales = ingresoBruto * 0.85;

  // Filter logs list
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.empresa_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.detalles.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.accion.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.accion === filterAction;
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(log.created_at) >= new Date(startDate);
    }
    if (endDate) {
      matchesDate = matchesDate && new Date(log.created_at) <= new Date(endDate + 'T23:59:59');
    }

    return matchesSearch && matchesAction && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Alert toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-fade-in ${
          message.type === 'success' ? 'bg-accent/15 border-accent/30 text-accent-bright' : 'bg-danger/15 border-danger/30 text-danger'
        }`}>
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Módulo Especial: Cuentas Locales en Modo Offline */}
      {isOffline && (
        <div className="bg-surface-card border-2 border-accent rounded-3xl p-6 space-y-4 shadow-xl shadow-accent/5">
          <div className="flex items-center gap-3 border-b border-surface-border pb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent-bright">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-md font-extrabold text-text-primary">Gestión Offline: Crear Cuenta para Cliente</h3>
              <p className="text-xs text-text-muted mt-0.5">Dado que la app está en modo offline (local), crea aquí la cuenta de acceso local para tu cliente.</p>
            </div>
          </div>

          <form onSubmit={handleCrearClienteOffline} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Nombre de la Empresa</label>
              <input
                type="text"
                placeholder="Ej. Condominio El Roble"
                value={offlineNombre}
                onChange={(e) => setOfflineNombre(e.target.value)}
                required
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Email del Administrador</label>
              <input
                type="email"
                placeholder="admin@condominio.com"
                value={offlineEmail}
                onChange={(e) => setOfflineEmail(e.target.value)}
                required
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Contraseña</label>
              <input
                type="text"
                placeholder="Clave para este cliente"
                value={offlinePassword}
                onChange={(e) => setOfflinePassword(e.target.value)}
                required
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 font-mono"
              />
            </div>
            <button
              type="submit"
              className="sm:col-span-3 bg-accent hover:bg-accent-bright text-black font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-accent/15 flex items-center justify-center gap-1.5"
            >
              Crear Cuenta de Cliente Offline
            </button>
          </form>

          {/* List of existing offline clients */}
          {(() => {
            const offlineUsersRaw = typeof window !== 'undefined' ? localStorage.getItem('vigia_offline_users') : null;
            const offlineUsers = offlineUsersRaw ? JSON.parse(offlineUsersRaw) : [];
            if (offlineUsers.length === 0) return null;
            return (
              <div className="pt-4 border-t border-surface-border/50">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Cuentas Offline Creadas:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {offlineUsers.map((u: any) => (
                    <div key={u.id} className="bg-surface p-3 border border-surface-border rounded-xl space-y-1 text-xs">
                      <p className="font-bold text-text-primary">{u.nombre}</p>
                      <p className="text-text-secondary"><span className="text-text-muted">Email:</span> {u.email}</p>
                      <p className="text-text-secondary"><span className="text-text-muted">Clave:</span> <code className="bg-surface-elevated px-1 py-0.5 rounded">{u.password}</code></p>
                      <button 
                        type="button"
                        onClick={() => {
                          const updated = offlineUsers.filter((x: any) => x.id !== u.id);
                          localStorage.setItem('vigia_offline_users', JSON.stringify(updated));
                          window.location.reload();
                        }}
                        className="text-danger hover:underline text-[10px] font-bold block pt-1.5 uppercase"
                      >
                        Eliminar Cuenta
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 1. Métricas Clientes */}
      <div>
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Métricas de Clientes</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <a href="/clientes" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-accent/40 hover:scale-[1.02] transition-all block">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-xl font-bold text-accent-bright">{totalClientes}</p>
            <p className="text-2xs text-text-secondary mt-1">Clientes Totales</p>
          </a>

          <a href="/clientes" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-info/40 hover:scale-[1.02] transition-all block">
            <div className="w-9 h-9 rounded-xl bg-info/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-info">{activos}</p>
            <p className="text-2xs text-text-secondary mt-1">Suscripciones Activas</p>
          </a>

          <a href="/clientes" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-warning/40 hover:scale-[1.02] transition-all block">
            <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-warning">{demos}</p>
            <p className="text-2xs text-text-secondary mt-1">Clientes en Demo (20d)</p>
          </a>

          <a href="/clientes" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-danger/40 hover:scale-[1.02] transition-all block">
            <div className="w-9 h-9 rounded-xl bg-danger/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-danger">{vencidos}</p>
            <p className="text-2xs text-text-secondary mt-1">Suscripciones Inactivas</p>
          </a>
        </div>
      </div>

      {/* 2. Métricas Financieras */}
      <div>
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Métricas Financieras (COP)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent-bright font-bold text-sm mb-3">
              $
            </div>
            <p className="text-xl font-bold text-accent-bright">${Number(ingresoTotal).toLocaleString('es-CO')} COP</p>
            <p className="text-2xs text-text-secondary mt-1">Facturación Potencial (MRR Total)</p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm mb-3">
              $
            </div>
            <p className="text-xl font-bold text-emerald-400">${Number(ingresoBruto).toLocaleString('es-CO')} COP</p>
            <p className="text-2xs text-text-secondary mt-1">Ingreso Bruto Mensual (Recaudo Real)</p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-sm mb-3">
              $
            </div>
            <p className="text-xl font-bold text-indigo-400">${Number(gananciasReales).toLocaleString('es-CO')} COP</p>
            <p className="text-2xs text-text-secondary mt-1">Ganancias Netas Reales (85% del Bruto)</p>
          </div>
        </div>
      </div>

      {/* 3. Captación & Búsqueda Google */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-text-primary">Buscador Embebido de Empresas</h4>
            <p className="text-xs text-text-muted mt-1">Encuentra nuevas empresas de seguridad privada y mándales invitaciones de prueba directamente.</p>
          </div>
          <form onSubmit={handleGoogleSearch} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Ej. empresas de seguridad privada Bogota"
                value={queryEmpresa}
                onChange={(e) => setQueryEmpresa(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl pl-3 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent/40"
              />
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent-bright"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setQueryEmpresa('empresas de seguridad privada Colombia'); }}
                className="text-[10px] px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary hover:bg-surface-border hover:text-text-primary"
              >
                Nacional
              </button>
              <button
                type="button"
                onClick={() => { setQueryEmpresa('conserjerias y porterias medellin'); }}
                className="text-[10px] px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary hover:bg-surface-border hover:text-text-primary"
              >
                Medellín
              </button>
              <button
                type="button"
                onClick={() => { setQueryEmpresa('empresas de seguridad cali'); }}
                className="text-[10px] px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary hover:bg-surface-border hover:text-text-primary"
              >
                Cali
              </button>
            </div>
            <button
              type="submit"
              className="w-full bg-surface-elevated hover:bg-surface-border text-text-primary font-bold text-xs py-2 px-4 rounded-xl border border-surface-border transition-all"
            >
              Buscar Empresas
            </button>
          </form>

          {iframeUrl && (
            <div className="border border-surface-border rounded-xl overflow-hidden mt-3 h-[420px] bg-white">
              <div className="bg-surface-elevated px-4 py-2 border-b border-surface-border flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-primary truncate max-w-[50%] font-mono">{iframeUrl}</span>
                <div className="flex gap-2">
                  <a 
                    href={iframeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-bright text-2xs font-bold transition-colors border border-accent/25 px-2 py-0.5 rounded-lg bg-accent/5 flex items-center gap-1"
                  >
                    Abrir Externo ↗
                  </a>
                  <button 
                    type="button" 
                    onClick={() => setIframeUrl(null)} 
                    className="text-danger hover:text-red-500 text-2xs font-bold transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              <iframe 
                src={iframeUrl} 
                className="w-full h-[380px] border-none"
                title="Buscador Embebido"
              />
            </div>
          )}
        </div>

        {/* Right: Invitation Sender widget */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-text-primary">Enviar Propuesta Comercial</h4>
            <p className="text-xs text-text-muted mt-1">Personaliza el mensaje y envíalo mediante WhatsApp o correo a tus prospectos.</p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Nombre Prospecto</label>
                <input
                  type="text"
                  placeholder="Ej. Seguridad Alfa"
                  value={inviteEmpresa}
                  required
                  onChange={(e) => setInviteEmpresa(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Email Prospecto (Opcional)</label>
                <input
                  type="email"
                  placeholder="Ej. info@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Cuerpo del Mensaje (Borrador Editable)</label>
              <textarea
                rows={7}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 font-sans resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleEnviarWhatsapp}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.793 1.452 5.485.002 9.947-4.461 9.95-9.95.002-2.658-1.03-5.158-2.903-7.03C16.518 1.751 14.024.72 11.365.719 5.882.719 1.419 5.181 1.416 10.669c-.002 1.677.444 3.313 1.293 4.757l-.963 3.518 3.606-.946zm11.45-6.78c-.265-.133-1.57-.775-1.812-.862-.243-.088-.42-.132-.596.132-.176.265-.682.862-.837 1.04-.155.176-.31.198-.574.065-.264-.132-1.114-.41-2.122-1.31-.784-.7-1.314-1.564-1.468-1.829-.154-.264-.016-.407.116-.54.12-.12.264-.309.396-.463.132-.154.176-.264.264-.44.088-.177.044-.33-.022-.463-.066-.133-.596-1.433-.816-1.963-.214-.518-.448-.448-.613-.456-.16-.008-.343-.01-.527-.01-.184 0-.485.07-.74.352-.254.282-.97.948-.97 2.31 0 1.362.99 2.678 1.13 2.855.14.176 1.948 2.974 4.72 4.17.659.284 1.174.453 1.576.581.662.21 1.265.18 1.742.109.531-.08 1.57-.64 1.791-1.258.22-.617.22-1.146.154-1.258-.066-.11-.243-.176-.507-.308z"/>
                </svg>
                Enviar WhatsApp
              </button>
              <button
                type="button"
                onClick={handleEnviarEmail}
                className="bg-accent hover:bg-accent-bright text-black font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Enviar por Email
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Invitaciones Enviadas */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-text-primary">Historial de Invitaciones Enviadas</h4>
          <p className="text-2xs text-text-muted mt-0.5">Control de empresas contactadas para evitar repetir envíos.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-border/50 text-[10px] uppercase tracking-wider text-text-secondary">
                <th className="py-2.5 px-3">Empresa</th>
                <th className="py-2.5 px-3">Detalles del Envió</th>
                <th className="py-2.5 px-3">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/30 text-xs">
              {logs.filter(l => l.accion === 'invitacion_enviada').map((l) => (
                <tr key={l.id} className="hover:bg-surface-elevated/10">
                  <td className="py-2.5 px-3 font-semibold text-accent-bright">{l.empresa_nombre}</td>
                  <td className="py-2.5 px-3 text-text-secondary">{l.detalles}</td>
                  <td className="py-2.5 px-3 text-text-muted font-mono">{new Date(l.created_at).toLocaleString('es-CO')}</td>
                </tr>
              ))}
              {logs.filter(l => l.accion === 'invitacion_enviada').length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-text-muted text-xs">
                    No se han registrado invitaciones enviadas en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Logs del Super Admin */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
          <div>
            <h4 className="text-sm font-bold text-text-primary">Logs del Módulo Comercial (Super Admin)</h4>
            <p className="text-2xs text-text-muted mt-0.5">Historial financiero, demos iniciadas, pagos y renovaciones.</p>
          </div>
          <button
            onClick={cargarLogs}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent-bright hover:bg-surface-elevated/40"
            title="Refrescar logs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 9H18.01" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <input
              type="text"
              placeholder="Buscar por empresa o detalles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent/40"
            >
              <option value="all">Todas las Acciones</option>
              <option value="demo_iniciada">Demo Iniciada</option>
              <option value="suscripcion_pagada">Suscripción Pagada</option>
              <option value="suscripcion_vencida">Suscripción Vencida</option>
              <option value="renovacion">Renovación</option>
              <option value="capacitacion_agregada">Capacitación Agregada</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Desde"
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Hasta"
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto border border-surface-border rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-surface-elevated/40 text-text-secondary font-semibold">
                <th className="p-3">FECHA/HORA</th>
                <th className="p-3">EMPRESA</th>
                <th className="p-3">ACCIÓN</th>
                <th className="p-3">PLAN</th>
                <th className="p-3">MONTO (COP)</th>
                <th className="p-3">DETALLES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {loadingLogs ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle" />
                    Cargando historial comercial...
                  </td>
                </tr>
              ) : filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-elevated/20 text-text-primary">
                  <td className="p-3 whitespace-nowrap text-text-secondary">
                    {new Date(log.created_at).toLocaleString('es-CO')}
                  </td>
                  <td className="p-3 font-semibold">{log.empresa_nombre}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      log.accion === 'suscripcion_pagada' || log.accion === 'renovacion'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : log.accion === 'demo_iniciada'
                        ? 'bg-warning/10 text-warning border border-warning/20'
                        : log.accion === 'suscripcion_vencida'
                        ? 'bg-danger/10 text-danger border border-danger/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {log.accion.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 capitalize">{log.tipo_plan}</td>
                  <td className="p-3 font-semibold">
                    {log.monto > 0 ? `$${Number(log.monto).toLocaleString('es-CO')}` : '-'}
                  </td>
                  <td className="p-3 text-text-secondary max-w-xs truncate" title={log.detalles}>
                    {log.detalles}
                  </td>
                </tr>
              ))}
              {!loadingLogs && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-text-muted">
                    No se encontraron registros comerciales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Módulo de Anuncios y Updates */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-6">
        <div className="border-b border-surface-border pb-3">
          <h4 className="text-sm font-bold text-text-primary">Anuncios & Comunicados de Actualización (System Updates)</h4>
          <p className="text-2xs text-text-muted mt-0.5">Publica mantenimientos, alertas o updates de versión para que aparezcan en letras rojas en la cabecera de la web y en la app móvil.</p>
        </div>

        <form onSubmit={handleCrearAnuncio} className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface p-4 rounded-xl border border-surface-border">
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Título del Anuncio</label>
            <input
              type="text"
              placeholder="Ej: Mantenimiento programado de servidores"
              value={anuncioTitulo}
              required
              onChange={(e) => setAnuncioTitulo(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Plataforma Objetivo</label>
            <select
              value={anuncioTipo}
              onChange={(e) => setAnuncioTipo(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent/40"
            >
              <option value="ambos">Ambas (Web y Móvil)</option>
              <option value="web">Solo Plataforma Web</option>
              <option value="movil">Solo App Móvil (Vigilantes)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Descripción / Detalles del Mantenimiento</label>
            <textarea
              placeholder="Explicación detallada de fecha, hora y duración del update..."
              value={anuncioDesc}
              required
              rows={2}
              onChange={(e) => setAnuncioDesc(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Mostrar Hasta (Fecha/Hora Fin)</label>
            <input
              type="datetime-local"
              value={anuncioFechaFin}
              required
              onChange={(e) => setAnuncioFechaFin(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent/40"
            />
          </div>
          <button
            type="submit"
            className="sm:col-span-3 bg-accent hover:bg-accent-bright text-black font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow"
          >
            Publicar Alerta General de Sistema
          </button>
        </form>

        <div className="space-y-3">
          <h5 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Historial de Anuncios Publicados</h5>
          <div className="overflow-x-auto border border-surface-border rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated/40 text-text-secondary font-semibold">
                  <th className="p-3">TÍTULO</th>
                  <th className="p-3">DETALLES</th>
                  <th className="p-3">OBJETIVO</th>
                  <th className="p-3">VENCE EL</th>
                  <th className="p-3 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/50">
                {loadingAnuncios ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-text-muted">Cargando anuncios...</td>
                  </tr>
                ) : anuncios.map((a) => {
                  const vencido = new Date(a.fecha_fin) < new Date();
                  return (
                    <tr key={a.id} className={`hover:bg-surface-elevated/20 text-text-primary ${vencido ? 'opacity-50' : ''}`}>
                      <td className="p-3 font-semibold text-danger">{a.titulo}</td>
                      <td className="p-3 max-w-xs truncate" title={a.descripcion}>{a.descripcion}</td>
                      <td className="p-3">
                        <span className="bg-surface-elevated px-2 py-0.5 rounded border border-surface-border text-[9px] uppercase font-bold text-text-secondary">
                          {a.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-text-secondary">
                        {new Date(a.fecha_fin).toLocaleString('es-CO')} {vencido && '(Vencido)'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleEliminarAnuncio(a.id)}
                          className="text-danger hover:underline font-bold text-[10px] uppercase"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loadingAnuncios && anuncios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-text-muted">No hay anuncios publicados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Wipe Total Mantenimiento */}
      <div className="bg-surface-card border border-danger/25 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-danger font-bold text-sm uppercase tracking-wider">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Mantenimiento de Producción (Wipe Total)</span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Elimina permanentemente de la base de datos todas las bitácoras de acceso, vehículos, equipos, turnos, novedades, chats, tickets de soporte, clientes de prueba y usuarios vinculados, manteniendo únicamente tu cuenta de Super Admin activa. Usa este botón para limpiar el sistema y dejarlo limpio antes del despliegue oficial.
        </p>
        <button
          onClick={handleWipeTotal}
          disabled={wiping}
          className="bg-danger hover:bg-danger/80 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {wiping && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {wiping ? 'Limpiando base de datos...' : 'Ejecutar Wipe de Producción'}
        </button>
      </div>
    </div>
  );
}
