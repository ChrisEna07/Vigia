import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

type Period = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'ano';

interface Registro {
  created_at: string;
  tipo_entrada: string;
  datos_jsonb: any;
}

interface Novedad {
  created_at: string;
}

export default function TableroAccesos() {
  const { institucionId, loading: authLoading } = useSession();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('hoy');
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [dentro, setDentro] = useState(0);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    if (!institucionId) return;

    fetchData();

    // Subscribe to insert updates on bitacora
    const channel = supabase
      .channel('tablero-metricas-en-vivo')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'bitacora_accesos',
        filter: `institucion_id=eq.${institucionId}`,
      }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [institucionId]);

  const fetchData = async () => {
    setLoadingMetrics(true);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

    const [bitacoraRes, novRes, dentroRes] = await Promise.all([
      supabase
        .from('bitacora_accesos')
        .select('created_at, tipo_entrada, datos_jsonb')
        .eq('institucion_id', institucionId)
        .gte('created_at', startOfYear),
      supabase
        .from('novedades')
        .select('created_at')
        .eq('institucion_id', institucionId)
        .gte('created_at', startOfYear),
      supabase.rpc('contar_dentro', { p_institucion_id: institucionId }).maybeSingle<number>(),
    ]);

    if (bitacoraRes.data) setRegistros(bitacoraRes.data as Registro[]);
    if (novRes.data) setNovedades(novRes.data as Novedad[]);
    if (dentroRes.data !== null) setDentro(dentroRes.data);
    setLoadingMetrics(false);
  };

  if (authLoading || loadingMetrics) return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!institucionId) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 text-center">
        <p className="text-sm text-text-muted">No hay institución asignada.</p>
      </div>
    );
  }

  // --- Calculations ---

  const now = new Date();
  
  // Set start boundaries
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const startOfTrimester = new Date(now);
  startOfTrimester.setDate(now.getDate() - 90);
  startOfTrimester.setHours(0, 0, 0, 0);

  const startOfSemester = new Date(now);
  startOfSemester.setDate(now.getDate() - 180);
  startOfSemester.setHours(0, 0, 0, 0);

  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const getStartBoundary = (p: Period) => {
    switch (p) {
      case 'hoy': return startOfDay;
      case 'semana': return startOfWeek;
      case 'mes': return startOfMonth;
      case 'trimestre': return startOfTrimester;
      case 'semestre': return startOfSemester;
      case 'ano': return startOfYear;
    }
  };

  const currentBoundary = getStartBoundary(selectedPeriod);

  // Filter records in javascript
  const filteredRegs = registros.filter(r => new Date(r.created_at) >= currentBoundary);
  const filteredNovs = novedades.filter(n => new Date(n.created_at) >= currentBoundary);

  const totalIngresos = filteredRegs.filter(r => r.tipo_entrada === 'ingreso').length;
  const totalSalidas = filteredRegs.filter(r => r.tipo_entrada === 'salida').length;
  const totalNovedades = filteredNovs.length;

  // Asset counts (YTD) - Only count unique assets on entries
  let autosCount = 0;
  let motosCount = 0;
  let portatilesCount = 0;

  const seenPlacas = new Set();
  const seenSerials = new Set();

  registros.forEach(r => {
    if (r.tipo_entrada !== 'ingreso') return;
    const data = r.datos_jsonb || {};
    if (data.placa) {
      const placaClean = data.placa.trim().toUpperCase();
      if (!seenPlacas.has(placaClean)) {
        seenPlacas.add(placaClean);
        if (data.tipo_vehiculo === 'moto') {
          motosCount++;
        } else {
          autosCount++;
        }
      }
    }
    if (data.serial) {
      const serialClean = data.serial.trim().toUpperCase();
      if (!seenSerials.has(serialClean)) {
        seenSerials.add(serialClean);
        portatilesCount++;
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Period selector tabs */}
      <div className="flex gap-1.5 p-1 bg-surface-card border border-surface-border rounded-xl max-w-lg overflow-x-auto">
        {(['hoy', 'semana', 'mes', 'trimestre', 'semestre', 'ano'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPeriod(p)}
            className={`text-2xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors whitespace-nowrap ${
              selectedPeriod === p
                ? 'bg-accent text-black'
                : 'text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            {p === 'ano' ? 'Año' : p}
          </button>
        ))}
      </div>

      {/* Main core stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Card: Ingresos */}
        <a href="/accesos" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-accent/40 hover:scale-[1.02] active:scale-[0.98] transition-all block">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-accent-bright">{totalIngresos}</p>
          <p className="text-xs text-text-secondary mt-1">Personas Ingresadas</p>
        </a>

        {/* Card: Salidas */}
        <a href="/accesos" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-danger/40 hover:scale-[1.02] active:scale-[0.98] transition-all block">
          <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 8l4 4m0 0l-4 4m4-4H3m5 4v1a3 3 0 003 3h7a3 3 0 003-3V7a3 3 0 00-3-3h-7a3 3 0 00-3 3v1" />
            </svg>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-danger">{totalSalidas}</p>
          <p className="text-xs text-text-secondary mt-1">Salidas Registradas</p>
        </a>

        {/* Card: Novedades */}
        <a href="/novedades" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-warning/40 hover:scale-[1.02] active:scale-[0.98] transition-all block">
          <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-warning">{totalNovedades}</p>
          <p className="text-xs text-text-secondary mt-1">Novedades Reportadas</p>
        </a>

        {/* Card: Dentro */}
        <a href="/accesos" className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-info/40 hover:scale-[1.02] active:scale-[0.98] transition-all block">
          <div className="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-info">{dentro}</p>
          <p className="text-xs text-text-secondary mt-1">Personas en Recinto</p>
        </a>
      </div>

      {/* Asset counts (YTD) */}
      <div>
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Elementos Registrados (Año en Curso)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Autos */}
          <a href="/accesos" className="bg-surface-card border border-surface-border rounded-2xl p-4 flex items-center gap-4 hover:border-accent/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-surface-border text-text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-text-primary">{autosCount}</p>
              <p className="text-2xs text-text-muted uppercase tracking-wider">Automóviles</p>
            </div>
          </a>

          {/* Motos */}
          <a href="/accesos" className="bg-surface-card border border-surface-border rounded-2xl p-4 flex items-center gap-4 hover:border-accent/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-surface-border text-text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-text-primary">{motosCount}</p>
              <p className="text-2xs text-text-muted uppercase tracking-wider">Motocicletas</p>
            </div>
          </a>

          {/* Portatiles */}
          <a href="/accesos" className="bg-surface-card border border-surface-border rounded-2xl p-4 flex items-center gap-4 hover:border-accent/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-surface-border text-text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-text-primary">{portatilesCount}</p>
              <p className="text-2xs text-text-muted uppercase tracking-wider">Portátiles y Equipos</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
