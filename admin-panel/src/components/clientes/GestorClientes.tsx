import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Institucion {
  id: string;
  nombre: string;
  slug: string;
  activa: boolean;
  plan_suscripcion: string;
  monto_mensual: number;
  fecha_vencimiento: string;
  estado_suscripcion: string;
  created_at: string;
}

interface ModuloConfig {
  id: string;
  institucion_id: string;
  modulo: 'vehiculos' | 'portatiles' | 'visitantes';
  activo: boolean;
}

export default function GestorClientes() {
  const { userRol, loading: authLoading } = useSession();

  // List states
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [modulos, setModulos] = useState<ModuloConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form states for New Client
  const [newNombre, setNewNombre] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPlan, setNewPlan] = useState('pro');
  const [newMonto, setNewMonto] = useState('350000');
  const [newEnDemo, setNewEnDemo] = useState(false);
  const [newTieneCapacitacion, setNewTieneCapacitacion] = useState(false);
  const [newHorasCapacitacion, setNewHorasCapacitacion] = useState(0);
  const [newAceptaDatos, setNewAceptaDatos] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);

  // Form states for New Admin User
  const [selectedInstId, setSelectedInstId] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAceptaDatos, setAdminAceptaDatos] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Form states for Editing Subscription
  const [editingInst, setEditingInst] = useState<Institucion | null>(null);
  const [editPlan, setEditPlan] = useState('basico');
  const [editMonto, setEditMonto] = useState('250000');
  const [editVencimiento, setEditVencimiento] = useState('');
  const [editEstado, setEditEstado] = useState('activa');
  const [updatingSubscription, setUpdatingSubscription] = useState(false);

  // Modal states for Client Details
  const [selectedDetailsInst, setSelectedDetailsInst] = useState<Institucion | null>(null);
  const [instAdmin, setInstAdmin] = useState<{ nombre_completo: string; email: string; activo: boolean } | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [recoveringAdmin, setRecoveringAdmin] = useState(false);
  const [recoveredCreds, setRecoveredCreds] = useState<{ email: string; clave: string } | null>(null);

  // States for created administrator credentials receipt
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [createdAdminReceipt, setCreatedAdminReceipt] = useState<{
    nombre: string;
    email: string;
    clave: string;
    clienteNombre: string;
  } | null>(null);

  // General messages
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (userRol === 'superadmin') {
      cargarDatos();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [userRol, authLoading]);

  const cargarDatos = async () => {
    setLoading(true);
    const { data: instData } = await supabase
      .from('instituciones')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: modData } = await supabase
      .from('modulos_config')
      .select('*');

    if (instData) setInstituciones(instData as Institucion[]);
    if (modData) setModulos(modData as ModuloConfig[]);
    setLoading(false);
  };

  const mostrarMensaje = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Auto-fill price based on plan selection (tiered pricing)
  useEffect(() => {
    if (editPlan === 'basico') {
      setEditMonto('250000');
    } else if (editPlan === 'pro') {
      setEditMonto('350000');
    } else if (editPlan === 'offline') {
      setEditMonto('0');
    }
  }, [editPlan]);

  // Auto-fill price based on plan selection for new client form
  useEffect(() => {
    if (newPlan === 'basico') {
      setNewMonto('250000');
    } else if (newPlan === 'pro') {
      setNewMonto('350000');
    } else if (newPlan === 'offline') {
      setNewMonto('0');
    }
  }, [newPlan]);

  const handleVerDetalles = async (inst: Institucion) => {
    setSelectedDetailsInst(inst);
    setLoadingAdmin(true);
    setInstAdmin(null);
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('nombre_completo, email, activo')
        .eq('institucion_id', inst.id)
        .eq('rol', 'admin_institucion')
        .maybeSingle();

      if (data) {
        setInstAdmin(data);
      }
    } catch (err) {
      console.error('Error loading client admin details:', err);
    } finally {
      setLoadingAdmin(false);
    }
  };

  const obtenerUrlPortal = () => {
    if (typeof window === 'undefined') return '';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'https://vigia-app.com' : window.location.origin;
  };

  const handleRecuperarCredenciales = async (email: string) => {
    if (!email) return;
    setRecoveringAdmin(true);
    const tempPassword = `VigiaTemp_${Math.random().toString(36).substring(2, 10)}!`;
    try {
      const res = await fetch('/api/update-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: tempPassword,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al restablecer contraseña.');

      // Log this recovery action
      await supabase.from('logs_superadmin').insert({
        empresa_nombre: selectedDetailsInst?.nombre || 'Empresa Desconocida',
        accion: 'Restablecimiento de Credenciales',
        tipo_plan: selectedDetailsInst?.plan_suscripcion || 'basico',
        monto: Number(selectedDetailsInst?.monto_mensual || 0),
        detalles: `Se generó una nueva contraseña temporal para el administrador (${email}) del cliente "${selectedDetailsInst?.nombre}". Clave: ${tempPassword}`
      });

      setRecoveredCreds({ email, clave: tempPassword });
      mostrarMensaje('success', 'Contraseña restablecida con éxito.');
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al restablecer credenciales.');
    } finally {
      setRecoveringAdmin(false);
    }
  };

  // 1. Create client
  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre || !newSlug) return;
    setCreatingClient(true);

    const duracionDias = newEnDemo ? 20 : 30;
    const limiteDateStr = new Date(Date.now() + duracionDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const { data: inst, error: instErr } = await supabase
        .from('instituciones')
        .insert({ 
          nombre: newNombre, 
          slug: newSlug.toLowerCase().trim(),
          plan_suscripcion: newPlan,
          monto_mensual: newEnDemo ? 0 : Number(newMonto),
          fecha_vencimiento: limiteDateStr,
          estado_suscripcion: 'activa',
          en_demo: newEnDemo,
          inicio_demo: newEnDemo ? new Date().toISOString().split('T')[0] : null,
          limite_demo: newEnDemo ? limiteDateStr : null,
          tiene_capacitacion: newTieneCapacitacion,
          horas_capacitacion: newTieneCapacitacion ? Number(newHorasCapacitacion) : 0,
          acepta_datos_ley: false,
          fecha_aceptacion_ley: null
        })
        .select()
        .single();

      if (instErr) throw instErr;

      // Insert default modules
      const modEntries = [
        { institucion_id: inst.id, modulo: 'vehiculos', activo: false },
        { institucion_id: inst.id, modulo: 'portatiles', activo: false },
        { institucion_id: inst.id, modulo: 'visitantes', activo: false },
      ];

      const { error: modErr } = await supabase.from('modulos_config').insert(modEntries);
      if (modErr) throw modErr;

      await supabase.from('logs_auditoria').insert({
        institucion_id: inst.id,
        actor_nombre: 'Super Admin (ChrizDev)',
        actor_rol: 'superadmin',
        accion: 'Creación de Cliente',
        detalles: `Se creó el cliente "${newNombre}" con slug "${newSlug}" (Plan: ${newPlan}, Demo: ${newEnDemo ? 'Sí' : 'No'})`
      });

      // Insert log into logs_superadmin
      await supabase.from('logs_superadmin').insert({
        empresa_nombre: newNombre,
        accion: newEnDemo ? 'demo_iniciada' : 'suscripcion_pagada',
        monto: newEnDemo ? 0 : Number(newMonto),
        tipo_plan: newPlan,
        detalles: `Cliente creado. ${newEnDemo ? 'Periodo Demo de 20 días activado.' : 'Suscripción regular activada.'} ${newTieneCapacitacion ? `Capacitación de ${newHorasCapacitacion} horas incluida.` : ''}`
      });

      mostrarMensaje('success', `Cliente "${newNombre}" creado con éxito.`);
      setNewNombre('');
      setNewSlug('');
      setNewEnDemo(false);
      setNewTieneCapacitacion(false);
      setNewHorasCapacitacion(0);
      setNewAceptaDatos(false);
      cargarDatos();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al crear el cliente.');
    } finally {
      setCreatingClient(false);
    }
  };

  // 2. Toggle active state
  const handleToggleActiva = async (inst: Institucion) => {
    try {
      const { error } = await supabase
        .from('instituciones')
        .update({ activa: !inst.activa })
        .eq('id', inst.id);

      if (error) throw error;

      await supabase.from('logs_auditoria').insert({
        institucion_id: inst.id,
        actor_nombre: 'Super Admin (ChrizDev)',
        actor_rol: 'superadmin',
        accion: !inst.activa ? 'Bloquear Cliente' : 'Activar Cliente',
        detalles: `Se cambió el estado de activa a ${!inst.activa}`
      });

      setInstituciones(prev =>
        prev.map(i => (i.id === inst.id ? { ...i, activa: !i.activa } : i))
      );
      mostrarMensaje('success', `Estado de ${inst.nombre} actualizado.`);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al actualizar el estado.');
    }
  };

  // 3. Toggle module active state
  const handleToggleModulo = async (instId: string, modulo: 'vehiculos' | 'portatiles' | 'visitantes') => {
    const config = modulos.find(m => m.institucion_id === instId && m.modulo === modulo);
    if (!config) return;

    try {
      const { error } = await supabase
        .from('modulos_config')
        .update({ activo: !config.activo })
        .eq('id', config.id);

      if (error) throw error;

      await supabase.from('logs_auditoria').insert({
        institucion_id: instId,
        actor_nombre: 'Super Admin (ChrizDev)',
        actor_rol: 'superadmin',
        accion: 'Cambio de Módulo',
        detalles: `Se cambió el estado del módulo "${modulo}" a ${!config.activo ? 'activo' : 'inactivo'}`
      });

      setModulos(prev =>
        prev.map(m => (m.id === config.id ? { ...m, activo: !m.activo } : m))
      );
      mostrarMensaje('success', `Módulo "${modulo}" actualizado.`);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al actualizar el módulo.');
    }
  };

  // 4. Create admin user
  const handleCrearAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstId || !adminNombre || !adminEmail || !adminPassword) {
      mostrarMensaje('error', 'Por favor complete todos los campos.');
      return;
    }
    if (!adminAceptaDatos) {
      mostrarMensaje('error', 'Debe confirmar que el cliente acepta los términos Habeas Data.');
      return;
    }
    setCreatingAdmin(true);

    try {
      // Use server-side API route (service_role) - avoids auth schema permission errors
      const res = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
          institucion_id: selectedInstId,
          nombre_completo: adminNombre,
          rol: 'admin_institucion',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear el administrador.');

      const newUserId = result.id;

      // Update Habeas Data acceptance state on the user profile
      if (newUserId) {
        await supabase
          .from('usuarios')
          .update({
            acepta_datos_ley: true,
            fecha_aceptacion_ley: new Date().toISOString()
          })
          .eq('id', newUserId);
      }

      const instObj = instituciones.find(i => i.id === selectedInstId);
      const clienteNombre = instObj ? instObj.nombre : 'Cliente';

      await supabase.from('logs_auditoria').insert({
        institucion_id: selectedInstId,
        actor_nombre: 'Super Admin (ChrizDev)',
        actor_rol: 'superadmin',
        accion: 'Registro de Administrador',
        detalles: `Se registró el administrador "${adminNombre}" con email "${adminEmail}" para el cliente "${clienteNombre}"`
      });

      await supabase.from('logs_superadmin').insert({
        empresa_nombre: clienteNombre,
        accion: 'admin_asignado',
        tipo_plan: instObj?.plan_suscripcion || 'basico',
        monto: Number(instObj?.monto_mensual || 0),
        detalles: `Se asignó el administrador "${adminNombre}" (${adminEmail}) a la empresa "${clienteNombre}"`
      });

      setCreatedAdminReceipt({
        nombre: adminNombre,
        email: adminEmail,
        clave: adminPassword,
        clienteNombre
      });

      mostrarMensaje('success', `Administrador "${adminNombre}" creado con éxito.`);
      setAdminNombre('');
      setAdminEmail('');
      setAdminPassword('');
      setSelectedInstId('');
      setAdminAceptaDatos(false);
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al crear el administrador.');
    } finally {
      setCreatingAdmin(false);
    }
  };

  // 5. Update subscription settings
  const selectForEdit = (inst: Institucion) => {
    setEditingInst(inst);
    setEditPlan(inst.plan_suscripcion || 'basico');
    setEditMonto(String(inst.monto_mensual ?? '29.99'));
    setEditVencimiento(inst.fecha_vencimiento || '');
    setEditEstado(inst.estado_suscripcion || 'activa');
  };

  const handleUpdateSuscripcion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;
    setUpdatingSubscription(true);

    try {
      const { error } = await supabase
        .from('instituciones')
        .update({
          plan_suscripcion: editPlan,
          monto_mensual: Number(editMonto),
          fecha_vencimiento: editVencimiento,
          estado_suscripcion: editEstado,
          activa: editEstado === 'activa'
        })
        .eq('id', editingInst.id);

      if (error) throw error;

      await supabase.from('logs_auditoria').insert({
        institucion_id: editingInst.id,
        actor_nombre: 'Super Admin (ChrizDev)',
        actor_rol: 'superadmin',
        accion: 'Actualización de Suscripción',
        detalles: `Se actualizó la suscripción de "${editingInst.nombre}": Plan "${editPlan}", Tarifa "${editMonto} COP", Estado "${editEstado}"`
      });

      // Insert log into logs_superadmin
      await supabase.from('logs_superadmin').insert({
        empresa_nombre: editingInst.nombre,
        accion: editEstado === 'activa' ? 'renovacion' : 'suscripcion_vencida',
        monto: Number(editMonto),
        tipo_plan: editPlan,
        detalles: `Suscripción actualizada. Estado: ${editEstado}. Vencimiento: ${editVencimiento}`
      });

      mostrarMensaje('success', `Suscripción de "${editingInst.nombre}" actualizada.`);
      setEditingInst(null);
      cargarDatos();
    } catch (err: any) {
      mostrarMensaje('error', err.message || 'Error al actualizar la suscripción.');
    } finally {
      setUpdatingSubscription(false);
    }
  };

  if (authLoading || (loading && instituciones.length === 0)) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (userRol !== 'superadmin') {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center max-w-lg mx-auto mt-10 space-y-4">
        <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-text-primary">Acceso Denegado</h3>
        <p className="text-sm text-text-secondary">Esta sección está restringida exclusivamente para el Super Administrador del sistema.</p>
        <a href="/" className="inline-block bg-accent hover:bg-accent-bright text-black font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
          Volver al Dashboard
        </a>
      </div>
    );
  }

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Client List */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-surface-border flex flex-col md:flex-row gap-4 items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Clientes Registrados</h3>
              <div className="relative max-w-xs w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre o slug..."
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
                    <th className="text-left px-5 py-3 font-medium">Nombre / Slug</th>
                    <th className="text-left px-5 py-3 font-medium">Plan / Tarifa</th>
                    <th className="text-left px-5 py-3 font-medium">Vencimiento</th>
                    <th className="text-left px-5 py-3 font-medium">Módulos</th>
                    <th className="text-left px-5 py-3 font-medium">Estado</th>
                    <th className="text-center px-5 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {instituciones
                    .filter(inst => 
                      inst.nombre.toLowerCase().includes(search.toLowerCase()) || 
                      inst.slug.toLowerCase().includes(search.toLowerCase())
                    )
                    .map(inst => {
                      const instModulos = modulos.filter(m => m.institucion_id === inst.id);
                      const isVencida = inst.estado_suscripcion === 'vencida' || !inst.activa;
                      return (
                        <tr key={inst.id} className="hover:bg-surface-elevated/40 transition-colors">
                          {/* Name / Slug */}
                          <td className="px-5 py-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-text-primary">{inst.nombre}</p>
                                {inst.en_demo && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md">
                                    DEMO
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted font-mono mt-0.5">{inst.slug}</p>
                            </div>
                          </td>
                          {/* Plan / Price */}
                          <td className="px-5 py-4">
                            <div>
                              <span className="text-xs capitalize px-2 py-0.5 rounded bg-surface border border-surface-border font-medium text-text-primary">
                                {inst.plan_suscripcion === 'basico'
                                  ? 'Básico'
                                  : inst.plan_suscripcion === 'pro'
                                    ? 'Vigia Pro'
                                    : inst.plan_suscripcion === 'offline'
                                      ? 'Vigia Offline'
                                      : (inst.plan_suscripcion || 'Básico')}
                              </span>
                              <p className="text-xs text-accent-bright font-bold mt-1">
                                ${Number(inst.monto_mensual || 0).toLocaleString('es-CO')} COP/mes
                              </p>
                            </div>
                          </td>
                          {/* Expiration */}
                          <td className="px-5 py-4 text-xs text-text-secondary">
                            {inst.fecha_vencimiento || 'Sin definir'}
                          </td>
                          {/* Modules */}
                          <td className="px-5 py-4">
                            <div className="flex gap-1 flex-wrap">
                              {['vehiculos', 'portatiles', 'visitantes'].map(modName => {
                                const cfg = instModulos.find(m => m.modulo === modName);
                                const active = cfg?.activo ?? false;
                                return (
                                  <button
                                    key={modName}
                                    onClick={() => handleToggleModulo(inst.id, modName as any)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                                      active
                                        ? 'bg-accent/10 text-accent-bright border-accent/30 hover:bg-accent/20'
                                        : 'bg-surface text-text-muted border-surface-border hover:bg-surface-elevated hover:text-text-secondary'
                                    }`}
                                  >
                                    {modName === 'vehiculos' ? 'Veh' : modName === 'portatiles' ? 'Port' : 'Vis'}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase ${!isVencida ? 'text-accent-bright' : 'text-danger'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${!isVencida ? 'bg-accent' : 'bg-danger'}`} />
                              {!isVencida ? 'Activa' : 'Vencida'}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-4 text-center space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleVerDetalles(inst)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent-bright hover:bg-accent/20 transition-colors"
                            >
                              Detalles
                            </button>
                            <button
                              onClick={() => selectForEdit(inst)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-surface border border-surface-border text-text-primary hover:border-accent/40 hover:text-accent-bright transition-colors"
                            >
                              Suscripción
                            </button>
                            <button
                              onClick={() => handleToggleActiva(inst)}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                                inst.activa
                                  ? 'bg-danger/10 text-danger hover:bg-danger/20'
                                  : 'bg-accent/15 text-accent-bright hover:bg-accent/25'
                              }`}
                            >
                              {inst.activa ? 'Bloquear' : 'Activar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {instituciones.filter(inst => 
                    inst.nombre.toLowerCase().includes(search.toLowerCase()) || 
                    inst.slug.toLowerCase().includes(search.toLowerCase())
                  ).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-sm text-text-muted">No hay clientes registrados</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="space-y-6">
          {/* Form: Manage Subscription */}
          {editingInst && (
            <div className="bg-surface-card border border-accent/40 rounded-2xl p-5 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-surface-border pb-2">
                <h3 className="text-sm font-bold text-accent-bright uppercase tracking-wider">Gestionar Suscripción</h3>
                <button onClick={() => setEditingInst(null)} className="text-text-muted hover:text-text-primary text-xs">Cancelar</button>
              </div>
              <p className="text-xs text-text-secondary">Cliente: <strong className="text-text-primary">{editingInst.nombre}</strong></p>
              <form onSubmit={handleUpdateSuscripcion} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Plan de Suscripción</label>
                  <select
                    value={editPlan}
                    onChange={e => setEditPlan(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  >
                    <option value="basico">Básico (Web Sola - 250K/mes)</option>
                    <option value="pro">Vigia Pro (Web + App - 350K/mes)</option>
                    <option value="offline">Vigia Offline (Local - $0/mes)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tarifa Mensual ($ COP)</label>
                  <input
                    type="number"
                    step="1000"
                    value={editMonto}
                    onChange={e => setEditMonto(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={editVencimiento}
                    onChange={e => setEditVencimiento(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Estado de Suscripción</label>
                  <select
                    value={editEstado}
                    onChange={e => setEditEstado(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  >
                    <option value="activa">Activa</option>
                    <option value="vencida">Vencida</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={updatingSubscription}
                  className="w-full bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl py-2 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingSubscription && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  {updatingSubscription ? 'Actualizando...' : 'Actualizar Suscripción'}
                </button>
              </form>
            </div>
          )}

          {/* Form: New Client */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-surface-border pb-2">Crear Nuevo Cliente</h3>
            <form onSubmit={handleCrearCliente} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nombre de la Empresa</label>
                <input
                  type="text"
                  placeholder="Ej. Seguridad Alfa"
                  value={newNombre}
                  onChange={e => {
                    setNewNombre(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                  }}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Slug (Identificador URL)</label>
                <input
                  type="text"
                  placeholder="ej. seguridad-alfa"
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Plan de Suscripción</label>
                <select
                  value={newPlan}
                  onChange={e => setNewPlan(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                >
                  <option value="basico">Básico (Web Sola - 250K/mes + Soporte prioritario)</option>
                  <option value="pro">Vigia Pro (Web + App - 350K/mes + Soporte prioritario)</option>
                  <option value="offline">Vigia Offline (Local - $0/mes)</option>
                </select>
              </div>

              {!newEnDemo && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tarifa Mensual ($ COP)</label>
                  <input
                    type="number"
                    step="1000"
                    value={newMonto}
                    onChange={e => setNewMonto(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>
              )}

              {/* Demo Toggle */}
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="newEnDemo"
                  checked={newEnDemo}
                  onChange={e => setNewEnDemo(e.target.checked)}
                  className="rounded border-surface-border text-accent focus:ring-accent w-4 h-4 bg-surface"
                />
                <label htmlFor="newEnDemo" className="text-xs font-medium text-text-primary cursor-pointer select-none">
                  Activar Prueba Demo de 20 Días (Gratis)
                </label>
              </div>

              {/* Capacitación Toggle */}
              <div className="space-y-3 p-3 bg-surface rounded-xl border border-surface-border">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="newTieneCapacitacion"
                    checked={newTieneCapacitacion}
                    onChange={e => setNewTieneCapacitacion(e.target.checked)}
                    className="rounded border-surface-border text-accent focus:ring-accent w-4 h-4 bg-surface"
                  />
                  <label htmlFor="newTieneCapacitacion" className="text-xs font-medium text-text-primary cursor-pointer select-none">
                    ¿Desea capacitación presencial? (+$85K/hora)
                  </label>
                </div>
                {newTieneCapacitacion && (
                  <div>
                    <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Horas de capacitación contratadas</label>
                    <input
                      type="number"
                      min={0}
                      value={newHorasCapacitacion}
                      onChange={e => setNewHorasCapacitacion(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-surface border border-surface-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent/50"
                    />
                    <p className="text-[10px] text-accent-bright font-bold mt-1">
                      Adicional único: ${(newHorasCapacitacion * 85000).toLocaleString('es-CO')} COP
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={creatingClient}
                className="w-full bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingClient && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                {creatingClient ? 'Creando...' : 'Crear Cliente'}
              </button>
            </form>
          </div>

          {/* Form: New Admin */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-surface-border pb-2">Registrar Administrador</h3>
            <form onSubmit={handleCrearAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Seleccionar Cliente</label>
                <select
                  value={selectedInstId}
                  onChange={e => setSelectedInstId(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  required
                >
                  <option value="">-- Elegir empresa --</option>
                  {instituciones.filter(i => i.activa).map(i => (
                    <option key={i.id} value={i.id}>{i.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={adminNombre}
                  onChange={e => setAdminNombre(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Email del Administrador</label>
                <input
                  type="email"
                  placeholder="admin@empresa.com"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showAdminPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl pl-3.5 pr-10 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showAdminPass ? (
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
              {/* Habeas Data Ley 1581 Checkbox for Administrator registration */}
              <div className="space-y-2 p-3 bg-danger/5 border border-danger/20 rounded-xl">
                <p className="text-[10px] text-danger leading-relaxed font-medium">
                  <strong>⚠️ AVISO LEGAL (Habeas Data):</strong> Al registrar este administrador, usted confirma que el usuario acepta la política de tratamiento de datos personales de VIGIA (Ley 1581 de 2012 de Colombia) para poder acceder al panel administrativo y gestionar vigilantes, horarios e ingresos.
                </p>
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="adminAceptaDatos"
                    checked={adminAceptaDatos}
                    onChange={e => setAdminAceptaDatos(e.target.checked)}
                    className="rounded border-surface-border text-accent focus:ring-accent w-4 h-4 bg-surface mt-0.5"
                    required
                  />
                  <label htmlFor="adminAceptaDatos" className="text-2xs font-bold text-text-primary cursor-pointer select-none leading-normal">
                    Confirmo que el administrador acepta el tratamiento de datos y Habeas Data
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingAdmin || !adminAceptaDatos}
                className="w-full bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingAdmin && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                {creatingAdmin ? 'Registrando...' : 'Registrar Administrador'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Client Details Modal (CRUD helper) */}
      {selectedDetailsInst && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 space-y-6 animate-fade-in relative shadow-2xl">
            <button
              onClick={() => setSelectedDetailsInst(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-sm font-semibold p-1"
            >
              ✕
            </button>
            <div className="border-b border-surface-border pb-3">
              <h3 className="text-base font-bold text-accent-bright uppercase tracking-wider">Detalles del Cliente</h3>
              <p className="text-2xs text-text-muted font-mono mt-0.5">ID: {selectedDetailsInst.id}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-text-muted font-medium">Nombre de la Empresa</p>
                  <p className="text-text-primary font-bold mt-1 text-sm">{selectedDetailsInst.nombre}</p>
                </div>
                <div>
                  <p className="text-text-muted font-medium">Slug (Identificador)</p>
                  <p className="text-text-primary font-mono mt-1 text-sm">{selectedDetailsInst.slug}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-surface-border/50 pt-3">
                <div>
                  <p className="text-text-muted font-medium">Plan Contratado</p>
                  <p className="text-text-primary font-semibold mt-1 capitalize">
                    {selectedDetailsInst.plan_suscripcion === 'basico'
                      ? 'Básico'
                      : selectedDetailsInst.plan_suscripcion === 'pro'
                        ? 'Vigia Pro'
                        : selectedDetailsInst.plan_suscripcion === 'offline'
                          ? 'Vigia Offline'
                          : (selectedDetailsInst.plan_suscripcion || 'Básico')}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted font-medium">Tarifa Mensual</p>
                  <p className="text-text-primary font-semibold mt-1">
                    ${Number(selectedDetailsInst.monto_mensual || 0).toLocaleString('es-CO')} COP/mes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-surface-border/50 pt-3">
                <div>
                  <p className="text-text-muted font-medium">Fecha de Vencimiento</p>
                  <p className="text-text-primary font-semibold mt-1">{selectedDetailsInst.fecha_vencimiento || 'Sin definir'}</p>
                </div>
                <div>
                  <p className="text-text-muted font-medium">Estado de Suscripción</p>
                  <span className={`inline-flex items-center gap-1.5 font-bold uppercase mt-1 ${
                    selectedDetailsInst.estado_suscripcion === 'activa' && selectedDetailsInst.activa ? 'text-accent-bright' : 'text-danger'
                  }`}>
                    {selectedDetailsInst.estado_suscripcion === 'activa' && selectedDetailsInst.activa ? 'ACTIVA' : 'VENCIDA'}
                  </span>
                </div>
              </div>

              <div className="border-t border-surface-border/50 pt-3 space-y-2">
                <p className="text-text-muted font-bold uppercase tracking-wider text-[10px]">Administrador Asignado</p>
                {loadingAdmin ? (
                  <div className="flex items-center gap-2 py-2">
                    <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-text-muted">Cargando administrador...</span>
                  </div>
                ) : instAdmin ? (
                  <div className="bg-surface p-3 rounded-xl border border-surface-border space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-text-primary font-bold">{instAdmin.nombre_completo}</p>
                        <p className="text-text-muted font-mono mt-0.5 text-2xs">{instAdmin.email}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${instAdmin.activo ? 'bg-accent/15 text-accent-bright' : 'bg-danger/10 text-danger'}`}>
                        {instAdmin.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-surface-border/40 flex justify-end">
                      <button
                        onClick={() => handleRecuperarCredenciales(instAdmin.email)}
                        disabled={recoveringAdmin}
                        className="bg-accent hover:bg-accent-bright disabled:opacity-50 text-black text-[10px] font-bold py-1 px-3 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        {recoveringAdmin && <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                        Reestablecer Clave Temporal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-surface rounded-xl border border-surface-border/50 text-center text-text-muted font-medium">
                    No se ha registrado ningún administrador para este cliente.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-surface-border pt-4 flex justify-end">
              <button
                onClick={() => setSelectedDetailsInst(null)}
                className="bg-accent hover:bg-accent-bright text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Credentials Receipt Modal */}
      {createdAdminReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 space-y-6 animate-fade-in relative shadow-2xl">
            <div className="border-b border-surface-border pb-3 text-center">
              <span className="w-12 h-12 rounded-full bg-accent/15 text-accent-bright flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
              <h3 className="text-base font-bold text-accent-bright uppercase tracking-wider">Credenciales Generadas</h3>
              <p className="text-xs text-text-secondary mt-1">Comparte o descarga estos datos de acceso.</p>
            </div>

            <div id="print-receipt-area" className="bg-surface p-4 rounded-xl border border-surface-border space-y-3 font-mono text-xs">
              <div className="border-b border-surface-border/50 pb-2 text-center text-text-muted font-sans text-2xs uppercase">
                Vigia - Comprobante de Acceso
              </div>
              <p><strong className="text-text-muted">Cliente:</strong> <span className="text-text-primary">{createdAdminReceipt.clienteNombre}</span></p>
              <p><strong className="text-text-muted">Nombre:</strong> <span className="text-text-primary">{createdAdminReceipt.nombre}</span></p>
              <p><strong className="text-text-muted">Email:</strong> <span className="text-text-primary">{createdAdminReceipt.email}</span></p>
              <p><strong className="text-text-muted">Contraseña:</strong> <span className="text-text-primary font-bold">{createdAdminReceipt.clave}</span></p>
              <p><strong className="text-text-muted">Rol:</strong> <span className="text-text-primary">Administrador de Cliente</span></p>
              <div className="border-t border-surface-border/50 pt-2 text-center text-text-muted font-sans text-2xs">
                Acceso al Portal: {obtenerUrlPortal()}/login
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (win) {
                    win.document.write(`
                      <html>
                        <head>
                          <title>Credenciales Vigia - ${createdAdminReceipt.nombre}</title>
                          <style>
                            body { font-family: monospace; padding: 40px; background: #fff; color: #000; }
                            .box { border: 1px solid #000; padding: 20px; border-radius: 8px; max-width: 400px; margin: 0 auto; }
                            h2 { text-align: center; margin-bottom: 20px; font-family: sans-serif; }
                            p { margin: 10px 0; }
                          </style>
                        </head>
                        <body>
                          <div class="box">
                            <h2>VIGIA - ACCESO</h2>
                            <p><strong>Cliente:</strong> ${createdAdminReceipt.clienteNombre}</p>
                            <p><strong>Nombre:</strong> ${createdAdminReceipt.nombre}</p>
                            <p><strong>Usuario/Email:</strong> ${createdAdminReceipt.email}</p>
                            <p><strong>Contraseña:</strong> ${createdAdminReceipt.clave}</p>
                            <p><strong>Rol:</strong> Administrador de Cliente</p>
                            <p style="text-align: center; font-size: 10px; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px;">
                              Ingresa en: ${obtenerUrlPortal()}
                            </p>
                          </div>
                          <script>window.print();</script>
                        </body>
                      </html>
                    `);
                    win.document.close();
                  }
                }}
                className="w-full bg-accent hover:bg-accent-bright text-black font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                📥 Descargar PDF / Imprimir
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `*VIGIA - Credenciales de Acceso*\n\nHola ${createdAdminReceipt.nombre},\naquí tienes tus datos para ingresar al panel:\n\n*Cliente:* ${createdAdminReceipt.clienteNombre}\n*Email:* ${createdAdminReceipt.email}\n*Contraseña:* ${createdAdminReceipt.clave}\n\nIngresa aquí: ${obtenerUrlPortal()}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-surface border border-surface-border text-text-primary hover:border-accent/40 font-bold text-xs py-2 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
                >
                  💬 WhatsApp
                </a>
                <a
                  href={`mailto:${createdAdminReceipt.email}?subject=${encodeURIComponent('Tus credenciales de Vigia')}&body=${encodeURIComponent(
                    `Hola ${createdAdminReceipt.nombre},\n\nSe ha creado tu cuenta de administrador en Vigia.\n\nCliente: ${createdAdminReceipt.clienteNombre}\nEmail: ${createdAdminReceipt.email}\nContraseña: ${createdAdminReceipt.clave}\n\nIngresa en: ${obtenerUrlPortal()}`
                  )}`}
                  className="bg-surface border border-surface-border text-text-primary hover:border-accent/40 font-bold text-xs py-2 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
                >
                  ✉️ Email
                </a>
              </div>
            </div>

            <div className="border-t border-surface-border pt-3 flex justify-end">
              <button
                onClick={() => setCreatedAdminReceipt(null)}
                className="bg-surface border border-surface-border hover:bg-surface-elevated text-text-primary font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {recoveredCreds && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in relative shadow-2xl">
            <div className="border-b border-surface-border pb-3 text-center">
              <span className="w-12 h-12 rounded-full bg-accent/15 text-accent-bright flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m-2 4h.01M17 21a2 2 0 01-2-2v-5a2 2 0 012-2h2a2 2 0 012 2v5a2 2 0 01-2 2h-2z" />
                </svg>
              </span>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Nueva Clave Temporal</h3>
              <p className="text-xs text-text-muted mt-0.5 font-medium">Se han actualizado las credenciales del administrador</p>
            </div>

            <div className="p-4 bg-surface rounded-xl border border-surface-border/50 space-y-2 text-xs">
              <p><strong className="text-text-muted">Email:</strong> <span className="text-text-primary font-mono">{recoveredCreds.email}</span></p>
              <p><strong className="text-text-muted">Nueva Contraseña:</strong> <span className="text-text-primary font-mono font-bold text-accent-bright select-all bg-accent/5 px-2 py-0.5 rounded border border-accent/10">{recoveredCreds.clave}</span></p>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `*VIGIA - Restablecimiento de Credenciales*\n\nHola,\ntu contraseña temporal ha sido restablecida:\n\n*Usuario:* ${recoveredCreds.email}\n*Contraseña:* ${recoveredCreds.clave}\n\nIngresa aquí: ${obtenerUrlPortal()}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-surface border border-surface-border text-text-primary hover:border-accent/40 font-bold text-xs py-2 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
                >
                  💬 WhatsApp
                </a>
                <a
                  href={`mailto:${recoveredCreds.email}?subject=${encodeURIComponent('Nueva clave temporal de Vigia')}&body=${encodeURIComponent(
                    `Hola,\n\nTu contraseña de administrador en Vigia ha sido restablecida.\n\nUsuario/Email: ${recoveredCreds.email}\nNueva Contraseña: ${recoveredCreds.clave}\n\nIngresa en: ${obtenerUrlPortal()}`
                  )}`}
                  className="bg-surface border border-surface-border text-text-primary hover:border-accent/40 font-bold text-xs py-2 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors"
                >
                  ✉️ Email
                </a>
              </div>
            </div>

            <div className="border-t border-surface-border pt-3 flex justify-end">
              <button
                onClick={() => setRecoveredCreds(null)}
                className="bg-accent hover:bg-accent-bright text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
