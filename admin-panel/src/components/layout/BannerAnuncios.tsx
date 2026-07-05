import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Anuncio {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  fecha_fin: string;
  created_at: string;
}

export default function BannerAnuncios() {
  const [activo, setActivo] = useState<Anuncio | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    cargarAnuncioActivo();

    const channel = supabase
      .channel('anuncios-en-vivo-web')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'anuncios',
      }, () => {
        cargarAnuncioActivo();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cargarAnuncioActivo = async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('anuncios')
        .select('*')
        .in('tipo', ['web', 'ambos'])
        .gt('fecha_fin', nowIso)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setActivo(data[0] as Anuncio);
      } else {
        setActivo(null);
        setShowDetail(false);
      }
    } catch (err) {
      console.error('Error loading active announcement:', err);
    }
  };

  if (!activo) return null;

  return (
    <>
      <div 
        onClick={() => setShowDetail(true)}
        className="bg-danger hover:bg-danger/95 text-white py-2.5 px-4 cursor-pointer text-xs font-bold transition-all shadow-md flex items-center justify-between gap-3 animate-pulse border-b border-danger/30 select-none z-[40]"
      >
        <div className="flex items-center gap-2 overflow-hidden truncate">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="uppercase text-[10px] bg-white/20 px-1.5 py-0.5 rounded tracking-wide shrink-0">
            Alerta de Sistema
          </span>
          <span className="truncate">{activo.titulo} — {activo.descripcion}</span>
        </div>
        <button className="text-[10px] underline hover:no-underline font-semibold shrink-0 uppercase tracking-wide">
          Ver Detalles
        </button>
      </div>

      {showDetail && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-danger/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in relative text-text-primary">
            <button
              onClick={() => setShowDetail(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-sm font-semibold p-1"
            >
              ✕
            </button>
            <div className="border-b border-surface-border pb-3">
              <span className="text-[10px] bg-danger/10 border border-danger/25 text-danger font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Actualización / Mantenimiento
              </span>
              <h3 className="text-base font-bold text-text-primary mt-2">{activo.titulo}</h3>
              <p className="text-2xs text-text-muted mt-0.5">
                Vence el: {new Date(activo.fecha_fin).toLocaleString('es-CO')}
              </p>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-text-secondary whitespace-pre-line">
              <p>{activo.descripcion}</p>
            </div>

            <div className="border-t border-surface-border pt-3 flex justify-end">
              <button
                onClick={() => setShowDetail(false)}
                className="bg-danger hover:bg-danger/90 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
