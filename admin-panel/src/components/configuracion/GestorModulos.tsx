import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Modulo {
  id: string;
  modulo: string;
  activo: boolean;
  config: Record<string, unknown>;
}

const MODULOS_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  vehiculos: { label: 'Vehículos', desc: 'Registrar placa, tipo y color del vehículo', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m2 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
  portatiles: { label: 'Portátiles / Equipos', desc: 'Registrar marca, serial y tipo de equipo', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  visitantes: { label: 'Visitantes', desc: 'Registrar datos adicionales del visitante', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
};

export default function GestorModulos() {
  const { institucionId, loading: authLoading } = useSession();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Accessibility and reload states
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('accessibility-font-size') || '1');
    }
    return 1;
  });

  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessibility-high-contrast') === 'true';
    }
    return false;
  });

  const [reloadingDb, setReloadingDb] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mostrarMensaje = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => {
    if (!institucionId) { setLoading(false); return; }
    cargarModulos();
  }, [institucionId]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}rem`;
    localStorage.setItem('accessibility-font-size', String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    localStorage.setItem('accessibility-high-contrast', String(highContrast));
  }, [highContrast]);

  const cargarModulos = async () => {
    const { data } = await supabase.from('modulos_config')
      .select('id,modulo,activo,config')
      .eq('institucion_id', institucionId);
    
    if (data && data.length > 0) setModulos(data);
    else setModulos(Object.keys(MODULOS_INFO).map((m) => ({ id: '', modulo: m, activo: false, config: {} })));
    setLoading(false);
  };

  const handleReloadDb = async () => {
    setReloadingDb(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await cargarModulos();
    setReloadingDb(false);
    mostrarMensaje('success', 'Base de datos recargada y sincronizada correctamente.');
  };

  const toggleModulo = async (modulo: string) => {
    const actual = modulos.find((m) => m.modulo === modulo);
    if (!actual) return;
    const nuevoEstado = !actual.activo;
    setSaving(modulo);
    setModulos((prev) => prev.map((m) => m.modulo === modulo ? { ...m, activo: nuevoEstado } : m));

    if (actual.id) {
      await supabase.from('modulos_config').update({ activo: nuevoEstado }).eq('id', actual.id);
    } else {
      const { data } = await supabase.from('modulos_config').insert({
        institucion_id: institucionId, modulo, activo: nuevoEstado, config: {},
      }).select('id').single();
      if (data) setModulos((prev) => prev.map((m) => m.modulo === modulo ? { ...m, id: data.id } : m));
    }
    setSaving(null);
  };

  if (authLoading || loading) return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!institucionId) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
        <p className="text-sm text-text-muted">No hay institución asignada.</p>
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

      {/* Sección Configuración Módulos */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-surface-border pb-2">Módulos de Vigilancia</h3>
        <div className="grid gap-3">
          {Object.entries(MODULOS_INFO).map(([key, info]) => {
            const mod = modulos.find((m) => m.modulo === key);
            const activo = mod?.activo ?? false;
            const isSaving = saving === key;

            return (
              <div key={key} className={`bg-surface border rounded-2xl p-4 transition-all ${
                activo ? 'border-accent/30 bg-surface-elevated/20' : 'border-surface-border'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                      activo ? 'bg-accent/15' : 'bg-surface-elevated'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${activo ? 'text-accent-bright' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={info.icon} />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-sm font-semibold truncate ${activo ? 'text-text-primary' : 'text-text-secondary'}`}>{info.label}</h3>
                      <p className="text-xs text-text-muted mt-0.5 truncate">{info.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleModulo(key)}
                    disabled={isSaving}
                    className={`relative shrink-0 w-12 h-6 rounded-full transition-colors ${
                      activo ? 'bg-accent' : 'bg-surface-border'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      activo ? 'translate-x-6' : 'translate-x-0.5'
                    } ${isSaving ? 'opacity-50' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opciones Accesibilidad */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-surface-border pb-2">Opciones de Accesibilidad</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-surface-border">
            <div>
              <p className="text-xs font-semibold text-text-primary">Tamaño de Texto</p>
              <p className="text-2xs text-text-muted mt-0.5">Ajusta el zoom general de la interfaz</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFontSize(prev => Math.max(0.8, prev - 0.05))}
                className="w-8 h-8 rounded-lg bg-surface-elevated text-text-primary hover:bg-surface-border font-bold text-xs flex items-center justify-center transition-colors"
                title="Reducir tamaño"
              >
                A-
              </button>
              <button
                onClick={() => setFontSize(1)}
                className="px-2 h-8 rounded-lg bg-surface-elevated text-text-primary hover:bg-surface-border text-xs flex items-center justify-center transition-colors"
              >
                Normal
              </button>
              <button
                onClick={() => setFontSize(prev => Math.min(1.25, prev + 0.05))}
                className="w-8 h-8 rounded-lg bg-surface-elevated text-text-primary hover:bg-surface-border font-bold text-xs flex items-center justify-center transition-colors"
                title="Aumentar tamaño"
              >
                A+
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-surface-border">
            <div>
              <p className="text-xs font-semibold text-text-primary">Alto Contraste</p>
              <p className="text-2xs text-text-muted mt-0.5">Mejora la legibilidad de colores</p>
            </div>
            <button
              onClick={() => setHighContrast(prev => !prev)}
              className={`relative shrink-0 w-12 h-6 rounded-full transition-colors ${
                highContrast ? 'bg-accent' : 'bg-surface-border'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                highContrast ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Sincronización DB */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider border-b border-surface-border pb-2">Base de Datos</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-surface rounded-xl border border-surface-border">
          <div>
            <p className="text-xs font-semibold text-text-primary">Sincronización y Recarga</p>
            <p className="text-2xs text-text-muted mt-0.5">Recarga de forma forzada los datos y esquemas de red</p>
          </div>
          <button
            onClick={handleReloadDb}
            disabled={reloadingDb}
            className={`relative overflow-hidden bg-accent hover:bg-accent-bright text-black font-semibold text-xs py-2 px-5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed ${
              reloadingDb ? 'opacity-80' : ''
            }`}
          >
            {/* Shimmer overlay during loading */}
            {reloadingDb && (
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                  animation: 'shimmer 1.2s infinite',
                  backgroundSize: '200% 100%',
                }}
              />
            )}
            {/* Animated circular arrows icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 flex-shrink-0 ${reloadingDb ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
            </svg>
            <span className="relative z-10">
              {reloadingDb ? 'Sincronizando...' : 'Recargar Base de Datos'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
