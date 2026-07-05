import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Acceso {
  id: string;
  nombre: string;
  documento: string;
  tipo_entrada: 'ingreso' | 'salida';
  created_at: string;
}

export default function HistorialEnVivo() {
  const { institucionId, loading: authLoading } = useSession();
  const [accesos, setAccesos] = useState<Acceso[]>([]);

  useEffect(() => {
    if (!institucionId) return;

    supabase
      .from('bitacora_accesos')
      .select('id,nombre,documento,tipo_entrada,created_at')
      .eq('institucion_id', institucionId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setAccesos(data);
      });

    const channel = supabase
      .channel('accesos-en-vivo')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bitacora_accesos',
        filter: `institucion_id=eq.${institucionId}`,
      }, (payload) => {
        setAccesos((prev) => [payload.new as Acceso, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [institucionId]);

  if (authLoading) return <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!institucionId) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
        <p className="text-sm text-text-muted">No hay institución asignada. <a href="/login" class="text-accent-bright hover:underline">Inicia sesión</a></p>
      </div>
    );
  }

  const formatearHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <div className="px-4 md:px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Historial en Vivo</h3>
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
      </div>
      <div className="divide-y divide-surface-border max-h-[420px] overflow-y-auto">
        {accesos.map((a) => (
          <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 md:px-5 py-3 hover:bg-surface-elevated/50 transition-colors gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${a.tipo_entrada === 'ingreso' ? 'bg-accent/15' : 'bg-danger/15'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${a.tipo_entrada === 'ingreso' ? 'text-accent-bright' : 'text-danger'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {a.tipo_entrada === 'ingreso'
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M13 8l4 4m0 0l-4 4m4-4H3m5 4v1a3 3 0 003 3h7a3 3 0 003-3V7a3 3 0 00-3-3h-7a3 3 0 00-3 3v1" />
                  }
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{a.nombre}</p>
                <p className="text-xs text-text-muted">Doc: {a.documento}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-12 sm:ml-0">
              <span className="text-xs text-text-muted shrink-0">{formatearHora(a.created_at)}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide shrink-0 ${
                a.tipo_entrada === 'ingreso'
                  ? 'bg-accent/15 text-accent-bright border border-accent/30'
                  : 'bg-danger/15 text-danger border border-danger/30'
              }`}>
                {a.tipo_entrada === 'ingreso' ? 'INGRESO' : 'SALIDA'}
              </span>
            </div>
          </div>
        ))}
        {accesos.length === 0 && (
          <p className="text-sm text-text-muted text-center py-10">No hay accesos registrados aún</p>
        )}
      </div>
    </div>
  );
}
