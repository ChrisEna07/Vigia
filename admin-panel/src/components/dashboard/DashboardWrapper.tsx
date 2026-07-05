import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';
import TableroAccesos from './TableroAccesos';
import HistorialEnVivo from './HistorialEnVivo';
import DashboardSuperAdmin from './DashboardSuperAdmin';

interface Institucion {
  id: string;
  nombre: string;
  slug: string;
  plan_suscripcion: string;
  monto_mensual: number;
  fecha_vencimiento: string;
  estado_suscripcion: string;
  activa: boolean;
}

export default function DashboardWrapper() {
  const { user, userRol, institucionId, loading: sessionLoading } = useSession();
  
  // Super Admin Stats
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [wiping, setWiping] = useState(false);

  // Onboarding States
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  const [onboardAceptaHabeas, setOnboardAceptaHabeas] = useState(false);
  const [onboardVehiculos, setOnboardVehiculos] = useState(false);
  const [onboardPortatiles, setOnboardPortatiles] = useState(false);
  const [onboardVisitantes, setOnboardVisitantes] = useState(false);

  // Wipe Modal States
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeTodo, setWipeTodo] = useState(true);
  const [wipeAccesos, setWipeAccesos] = useState(false);
  const [wipeNovedades, setWipeNovedades] = useState(false);
  const [wipeChats, setWipeChats] = useState(false);
  const [wipeAutorizaciones, setWipeAutorizaciones] = useState(false);
  const [wipeClientes, setWipeClientes] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mostrarMensaje = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4500);
  };

  useEffect(() => {
    if (userRol !== 'superadmin') return;
    cargarInstitucionesGlobales();
  }, [userRol]);

  const cargarInstitucionesGlobales = async () => {
    setLoadingGlobal(true);
    const { data } = await supabase
      .from('instituciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setInstituciones(data as Institucion[]);
    setLoadingGlobal(false);
  };

  useEffect(() => {
    if (userRol !== 'admin_institucion' || !user?.id) return;
    
    const checkAceptaDatos = async () => {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('acepta_datos_ley')
          .eq('id', user.id)
          .single();
        if (data && !data.acepta_datos_ley) {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.error('Error checking Habeas Data acceptance:', err);
      }
    };

    checkAceptaDatos();
  }, [userRol, user?.id]);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardAceptaHabeas) {
      mostrarMensaje('error', 'Debes aceptar las políticas de datos personales (Habeas Data) para continuar.');
      return;
    }
    setLoadingOnboarding(true);

    try {
      // 1. Update user profile to set acepta_datos_ley = true
      const { error: userErr } = await supabase
        .from('usuarios')
        .update({
          acepta_datos_ley: true,
          fecha_aceptacion_ley: new Date().toISOString()
        })
        .eq('id', user!.id);

      if (userErr) throw userErr;

      // 2. Update modules configuration in modulos_config for this institution
      const updates = [
        { modulo: 'vehiculos', activo: onboardVehiculos },
        { modulo: 'portatiles', activo: onboardPortatiles },
        { modulo: 'visitantes', activo: onboardVisitantes }
      ];

      for (const update of updates) {
        await supabase
          .from('modulos_config')
          .update({ activo: update.activo })
          .eq('institucion_id', institucionId)
          .eq('modulo', update.modulo);
      }

      mostrarMensaje('success', '¡Configuración inicial completada! Bienvenido a Vigia.');
      setShowOnboarding(false);
    } catch (err: any) {
      mostrarMensaje('error', 'Error al guardar onboarding: ' + (err.message || err));
    } finally {
      setLoadingOnboarding(false);
    }
  };

  const handleWipeTotal = async () => {
    setWiping(true);
    try {
      const response = await fetch('/api/wipe-produccion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wipeTodo,
          wipeAccesos,
          wipeNovedades,
          wipeChats,
          wipeAutorizaciones,
          wipeClientes,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Error al ejecutar el wipe.');
      }

      mostrarMensaje('success', resData.message || 'Wipe ejecutado con éxito.');
      setShowWipeModal(false);
      setTimeout(() => {
        cargarInstitucionesGlobales();
      }, 1500);
    } catch (err: any) {
      mostrarMensaje('error', 'Error al ejecutar el wipe: ' + (err.message || err));
    } finally {
      setWiping(false);
    }
  };

  if (sessionLoading) return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center h-[300px]">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // --- RENDER SUPER ADMIN VIEW ---
  if (userRol === 'superadmin') {
    return (
      <>
        {/* Alert toast */}
        {message && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-fade-in ${
            message.type === 'success' ? 'bg-accent/15 border-accent/30 text-accent-bright' : 'bg-danger/15 border-danger/30 text-danger'
          }`}>
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        <DashboardSuperAdmin
          instituciones={instituciones}
          wiping={wiping}
          handleWipeTotal={async () => setShowWipeModal(true)}
        />

        {showWipeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-card border border-surface-border rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-surface-border pb-3">
                <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Limpieza de Base de Datos (Wipe)</h3>
                  <p className="text-2xs text-text-muted mt-0.5">Selecciona qué secciones deseas vaciar para producción</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-surface/50 hover:bg-surface transition-colors cursor-pointer select-none">
                  <input
                    type="radio"
                    name="wipeType"
                    checked={wipeTodo}
                    onChange={() => {
                      setWipeTodo(true);
                      setWipeAccesos(false);
                      setWipeNovedades(false);
                      setWipeChats(false);
                      setWipeAutorizaciones(false);
                      setWipeClientes(false);
                    }}
                    className="text-danger focus:ring-danger"
                  />
                  <div>
                    <p className="text-xs font-bold text-text-primary">Wipe Total Absoluto</p>
                    <p className="text-2xs text-text-muted mt-0.5">Limpia absolutamente todo del sistema (bitácoras, novedades, chats, autorizaciones y clientes) excepto tu cuenta Super Admin.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-surface-border bg-surface/50 hover:bg-surface transition-colors cursor-pointer select-none">
                  <input
                    type="radio"
                    name="wipeType"
                    checked={!wipeTodo}
                    onChange={() => setWipeTodo(false)}
                    className="text-danger focus:ring-danger"
                  />
                  <div>
                    <p className="text-xs font-bold text-text-primary">Wipe Selectivo por Secciones</p>
                    <p className="text-2xs text-text-muted mt-0.5">Elige individualmente las tablas y módulos específicos que deseas vaciar.</p>
                  </div>
                </label>

                {!wipeTodo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8 p-3 bg-surface/30 rounded-xl border border-surface-border/50 animate-slide-down">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={wipeAccesos}
                        onChange={(e) => setWipeAccesos(e.target.checked)}
                        className="rounded border-surface-border text-danger focus:ring-danger w-4 h-4 bg-surface"
                      />
                      <span className="text-xs text-text-secondary font-medium">Bitácora de Accesos</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={wipeNovedades}
                        onChange={(e) => setWipeNovedades(e.target.checked)}
                        className="rounded border-surface-border text-danger focus:ring-danger w-4 h-4 bg-surface"
                      />
                      <span className="text-xs text-text-secondary font-medium">Turnos y Novedades</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={wipeChats}
                        onChange={(e) => setWipeChats(e.target.checked)}
                        className="rounded border-surface-border text-danger focus:ring-danger w-4 h-4 bg-surface"
                      />
                      <span className="text-xs text-text-secondary font-medium">Mensajes / Chats</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={wipeAutorizaciones}
                        onChange={(e) => setWipeAutorizaciones(e.target.checked)}
                        className="rounded border-surface-border text-danger focus:ring-danger w-4 h-4 bg-surface"
                      />
                      <span className="text-xs text-text-secondary font-medium">Autorizaciones</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none col-span-2 mt-1 pt-2 border-t border-surface-border/40">
                      <input
                        type="checkbox"
                        checked={wipeClientes}
                        onChange={(e) => setWipeClientes(e.target.checked)}
                        className="rounded border-surface-border text-danger focus:ring-danger w-4 h-4 bg-surface"
                      />
                      <div>
                        <span className="text-xs text-danger font-bold">Clientes y sus Usuarios</span>
                        <p className="text-[10px] text-text-muted mt-0.5">Elimina empresas/tenants registradas, administradores de sucursales y vigilantes.</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className="p-3 bg-danger/5 border border-danger/20 rounded-xl">
                <p className="text-[10px] text-danger leading-relaxed font-medium">
                  <strong>⚠️ ADVERTENCIA DE ELIMINACIÓN:</strong> Esta acción no se puede deshacer. Los datos marcados serán eliminados de forma permanente de las bases de datos de producción de VIGIA.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowWipeModal(false)}
                  className="px-4 py-2 rounded-xl border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleWipeTotal}
                  disabled={wiping || (!wipeTodo && !wipeAccesos && !wipeNovedades && !wipeChats && !wipeAutorizaciones && !wipeClientes)}
                  className="px-5 py-2 rounded-xl bg-danger hover:bg-danger/80 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {wiping && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {wiping ? 'Ejecutando...' : 'Confirmar y Borrar Permanentemente'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // --- RENDER STANDARD TENANT ADMIN VIEW ---
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

      <TableroAccesos />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HistorialEnVivo />
        <a href="/configuracion" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-accent/30 transition-all group">
          <h3 className="text-sm font-semibold text-text-primary mb-2 group-hover:text-accent-bright transition-colors">Configuración de Módulos</h3>
          <p className="text-sm text-text-secondary">Activa o desactiva los módulos de registro para tu institución</p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent-bright">Vehículos</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent-bright">Portátiles</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent-bright">Visitantes</span>
          </div>
        </a>
      </div>

      {/* Modal Onboarding Obligatorio: Primer Inicio de Sesión */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleOnboardingSubmit} className="bg-surface-card border border-surface-border rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 border-b border-surface-border pb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent-bright shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-md font-extrabold text-text-primary">¡Bienvenido a VIGIA!</h3>
                <p className="text-xs text-text-muted mt-0.5">Asistente de configuración inicial para tu institución.</p>
              </div>
            </div>

            {/* Paso 1: Habeas Data */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-accent-bright uppercase tracking-wider block">Paso 1: Consentimiento de Tratamiento de Datos</span>
              <div className="p-3 bg-surface border border-surface-border rounded-xl space-y-2">
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  En cumplimiento de la Ley 1581 de 2012 de Habeas Data en Colombia y normativas internacionales de privacidad, requerimos su aceptación expresa para el tratamiento y almacenamiento seguro de los datos personales ingresados en el sistema (visitantes, contratistas, vigilantes, patentes de vehículos, seriales y marcas de computadores).
                </p>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onboardAceptaHabeas}
                    onChange={(e) => setOnboardAceptaHabeas(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent bg-surface border-surface-border mt-0.5 cursor-pointer"
                    required
                  />
                  <span className="text-2xs font-bold text-text-primary leading-normal">
                    Acepto de manera libre e informada las políticas de tratamiento de datos personales de VIGIA.
                  </span>
                </label>
              </div>
            </div>

            {/* Paso 2: Encuesta de Módulos */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-accent-bright uppercase tracking-wider block">Paso 2: Encuesta de Elementos a Controlar</span>
              <p className="text-[11px] text-text-muted">¿Qué elementos deseas registrar o vigilar en tus porterías hoy? (Puedes modificar esto luego):</p>
              <div className="grid grid-cols-3 gap-2.5">
                <label className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                  onboardVehiculos ? 'bg-accent/10 border-accent/40 text-accent-bright font-bold' : 'bg-surface border-surface-border text-text-secondary hover:bg-surface-elevated/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={onboardVehiculos}
                    onChange={(e) => setOnboardVehiculos(e.target.checked)}
                    className="hidden"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 011-1v-4a1 1 0 011-1h2m4-1V9a1 1 0 00-1-1h-2a1 1 0 00-1 1v4M12 16h6m0 0a2 2 0 002-2v-4a2 2 0 00-2-2h-3M9 16.5L12 14" />
                  </svg>
                  <span className="text-[10px]">Vehículos</span>
                </label>

                <label className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                  onboardPortatiles ? 'bg-accent/10 border-accent/40 text-accent-bright font-bold' : 'bg-surface border-surface-border text-text-secondary hover:bg-surface-elevated/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={onboardPortatiles}
                    onChange={(e) => setOnboardPortatiles(e.target.checked)}
                    className="hidden"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px]">Equipos</span>
                </label>

                <label className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                  onboardVisitantes ? 'bg-accent/10 border-accent/40 text-accent-bright font-bold' : 'bg-surface border-surface-border text-text-secondary hover:bg-surface-elevated/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={onboardVisitantes}
                    onChange={(e) => setOnboardVisitantes(e.target.checked)}
                    className="hidden"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[10px]">Visitantes</span>
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-surface-border/50 flex flex-col gap-2">
              <p className="text-[9px] text-text-muted leading-relaxed text-center">
                Nota: Recuerda que puedes modificar la activación de estos módulos en cualquier momento desde el menú de <strong>Configuración</strong> en la barra lateral.
              </p>
              <button
                type="submit"
                disabled={loadingOnboarding || !onboardAceptaHabeas}
                className="w-full bg-accent hover:bg-accent-bright text-black font-extrabold rounded-xl py-2.5 text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-accent/15"
              >
                {loadingOnboarding && <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                Finalizar y Entrar al Panel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
