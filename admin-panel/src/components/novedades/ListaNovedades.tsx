import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Novedad {
  id: string;
  titulo: string;
  descripcion: string;
  created_at: string;
  creador_id: string | null;
  vigilante_id: string;
  evidencia_url: string | null;
  vigilante: { nombre_completo: string } | null;
  creador: { nombre_completo: string } | null;
}

export default function ListaNovedades() {
  const { institucionId, loading: authLoading } = useSession();
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedNov, setSelectedNov] = useState<Novedad | null>(null);

  useEffect(() => {
    if (!institucionId) return;
    cargar(true);

    const channel = supabase
      .channel('novedades-lista-en-vivo')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'novedades',
        filter: `institucion_id=eq.${institucionId}`,
      }, () => {
        cargar(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [institucionId]);

  const cargar = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const { data } = await supabase
      .from('novedades')
      .select(`
        id,
        titulo,
        descripcion,
        created_at,
        creador_id,
        vigilante_id,
        evidencia_url,
        vigilante:usuarios!vigilante_id(nombre_completo),
        creador:usuarios!creador_id(nombre_completo)
      `)
      .eq('institucion_id', institucionId)
      .order('created_at', { ascending: false });

    if (data) {
      setNovedades(data as any);
    }
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filtradas = novedades.filter(n => {
    const q = search.toLowerCase();
    const vigilanteName = n.vigilante?.nombre_completo.toLowerCase() ?? '';
    const creatorName = n.creador?.nombre_completo.toLowerCase() ?? '';
    return n.titulo.toLowerCase().includes(q) ||
           n.descripcion.toLowerCase().includes(q) ||
           vigilanteName.includes(q) ||
           creatorName.includes(q);
  });

  const formatearFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden space-y-4">
      <div className="p-4 border-b border-surface-border">
        <div className="relative max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por título, descripción, vigilante o creador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-xl pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtradas.map(n => {
          const isGuardCreator = n.creador_id === n.vigilante_id;
          return (
            <div key={n.id} className="bg-surface border border-surface-border rounded-2xl p-5 space-y-4 hover:border-accent/20 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-elevated border border-surface-border text-accent-bright uppercase tracking-wide truncate max-w-[150px]">
                    {n.titulo}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">{formatearFecha(n.created_at)}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed bg-surface-card/30 p-3 rounded-xl border border-surface-border/50 line-clamp-3">
                  {n.descripcion}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-surface-border/40 pt-3 mt-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center">
                    <span className="text-3xs font-bold text-accent-bright">
                      {(n.creador?.nombre_completo || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-muted leading-tight">
                      Reportado por: <span className="font-semibold text-text-primary">{n.creador?.nombre_completo || 'Sistema'}</span>
                    </span>
                    {!isGuardCreator && (
                      <span className="text-[9px] text-text-muted font-medium leading-none mt-0.5">
                        Relacionado a: {n.vigilante?.nombre_completo || 'Vigilante'}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedNov(n)}
                  className="bg-accent/10 hover:bg-accent/25 text-accent-bright text-xs font-bold py-1 px-3 rounded-lg flex items-center gap-1.5 transition-colors border border-accent/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver Detalle
                </button>
              </div>
            </div>
          );
        })}
        {filtradas.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-text-muted">
            No se encontraron novedades o reportes de turno.
          </div>
        )}
      </div>

      {/* Novelty Detail Modal with Multimedia Viewer */}
      {selectedNov && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 space-y-4 animate-fade-in relative shadow-2xl">
            <button
              onClick={() => setSelectedNov(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-sm font-semibold p-1"
            >
              ✕
            </button>
            <div className="border-b border-surface-border pb-3">
              <span className="text-[10px] bg-accent/15 border border-accent/20 text-accent-bright font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {selectedNov.titulo}
              </span>
              <h3 className="text-base font-bold text-text-primary mt-2">Detalles de Novedad</h3>
              <p className="text-2xs text-text-muted mt-0.5 font-mono">{formatearFecha(selectedNov.created_at)}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-surface p-3 rounded-xl border border-surface-border">
                <div>
                  <p className="text-text-muted font-medium">Reportado Por</p>
                  <p className="text-text-primary font-bold mt-0.5">
                    {selectedNov.creador?.nombre_completo || 'Desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted font-medium">Vigilante Relacionado</p>
                  <p className="text-text-primary font-bold mt-0.5">
                    {selectedNov.vigilante?.nombre_completo || 'Vigilante'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-text-muted font-medium">Detalle del Reporte</p>
                <p className="text-text-secondary leading-relaxed bg-surface-card p-3 rounded-xl border border-surface-border/50 text-[13px] whitespace-pre-wrap">
                  {selectedNov.descripcion}
                </p>
              </div>

              {selectedNov.evidencia_url && (
                <div className="space-y-1.5 border-t border-surface-border/40 pt-3">
                  <p className="text-text-muted font-medium">Evidencia (Multimedia)</p>
                  {selectedNov.evidencia_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                    <div className="rounded-xl overflow-hidden border border-surface-border bg-black/20 max-h-[220px] flex items-center justify-center">
                      <img
                        src={selectedNov.evidencia_url}
                        alt="Evidencia"
                        className="max-h-[220px] object-contain hover:scale-102 transition-all cursor-zoom-in"
                        onClick={() => window.open(selectedNov.evidencia_url!, '_blank')}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-surface-border">
                      <span className="text-2xs font-mono text-text-secondary truncate max-w-[200px]">
                        {selectedNov.evidencia_url.split('/').pop()}
                      </span>
                      <a
                        href={selectedNov.evidencia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-accent hover:bg-accent-bright text-black font-bold text-xs py-1 px-3 rounded-lg transition-colors flex items-center gap-1"
                      >
                        Abrir Archivo
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-surface-border pt-3 flex justify-end">
              <button
                onClick={() => setSelectedNov(null)}
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
