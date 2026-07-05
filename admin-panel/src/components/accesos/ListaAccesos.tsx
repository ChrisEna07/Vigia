import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Acceso {
  id: string;
  nombre: string;
  documento: string;
  tipo_documento: string;
  tipo_entrada: 'ingreso' | 'salida';
  observaciones: string | null;
  created_at: string;
  datos_jsonb?: Record<string, any> | null;
  usuarios?: { nombre_completo: string } | null;
}

export default function ListaAccesos() {
  const { institucionId, loading: authLoading } = useSession();
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'ingreso' | 'salida'>('todos');
  const [selectedAcceso, setSelectedAcceso] = useState<Acceso | null>(null);

  useEffect(() => {
    if (!institucionId) return;
    cargar();
    const channel = supabase
      .channel('accesos-lista')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'bitacora_accesos',
        filter: `institucion_id=eq.${institucionId}`,
      }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [institucionId]);

  const cargar = async () => {
    const { data } = await supabase
      .from('bitacora_accesos')
      .select('id,nombre,documento,tipo_documento,tipo_entrada,observaciones,created_at,datos_jsonb,usuarios(nombre_completo)')
      .eq('institucion_id', institucionId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setAccesos(data as any);
  };

  if (authLoading) return <div className="bg-surface-card border border-surface-border rounded-2xl p-8 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!institucionId) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
        <p className="text-sm text-text-muted">No hay institución asignada. <a href="/login" className="text-accent-bright hover:underline">Inicia sesión</a></p>
      </div>
    );
  }

  const formatearFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const filtrados = accesos.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = a.nombre.toLowerCase().includes(q) || a.documento.includes(q);
    const matchTipo = filtro === 'todos' || a.tipo_entrada === filtro;
    return matchSearch && matchTipo;
  });

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <div className="p-3 md:p-4 border-b border-surface-border flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" placeholder="Buscar por nombre o documento..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['todos', 'ingreso', 'salida'] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filtro === f
                  ? f === 'todos' ? 'bg-surface-elevated text-text-primary' : f === 'ingreso' ? 'bg-accent/15 text-accent-bright' : 'bg-danger/15 text-danger'
                  : 'bg-surface text-text-muted hover:text-text-secondary'
              }`}>
              {f === 'todos' ? 'Todos' : f === 'ingreso' ? 'Ingresos' : 'Salidas'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-surface-border text-xs text-text-muted uppercase tracking-wider">
              <th className="text-left px-4 md:px-5 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 md:px-5 py-3 font-medium">Documento</th>
              <th className="text-left px-4 md:px-5 py-3 font-medium">Tipo</th>
              <th className="text-left px-4 md:px-5 py-3 font-medium">Estado Actual</th>
              <th className="text-left px-4 md:px-5 py-3 font-medium hidden sm:table-cell">Fecha</th>
              <th className="text-left px-4 md:px-5 py-3 font-medium hidden md:table-cell">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtrados.map((a) => {
              const estadoActual = (() => {
                const ultimo = accesos.find((rec) => rec.documento === a.documento);
                return ultimo?.tipo_entrada === 'ingreso' ? 'Dentro' : 'Fuera';
              })();

              return (
                <tr key={a.id} onClick={() => setSelectedAcceso(a)} className="hover:bg-surface-elevated/40 transition-colors cursor-pointer">
                  <td className="px-4 md:px-5 py-3 md:py-4">
                    <p className="text-sm font-medium text-text-primary truncate max-w-[160px] md:max-w-none">{a.nombre}</p>
                  </td>
                  <td className="px-4 md:px-5 py-3 md:py-4">
                    <span className="text-sm text-text-secondary whitespace-nowrap">{a.tipo_documento} {a.documento}</span>
                  </td>
                  <td className="px-4 md:px-5 py-3 md:py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap ${
                      a.tipo_entrada === 'ingreso'
                        ? 'bg-accent/15 text-accent-bright border border-accent/30'
                        : 'bg-danger/15 text-danger border border-danger/30'
                    }`}>
                      {a.tipo_entrada === 'ingreso' ? 'INGRESO' : 'SALIDA'}
                    </span>
                  </td>
                  <td className="px-4 md:px-5 py-3 md:py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase ${
                      estadoActual === 'Dentro' ? 'text-accent-bright' : 'text-text-muted'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        estadoActual === 'Dentro' ? 'bg-accent' : 'bg-text-muted'
                      }`} />
                      {estadoActual === 'Dentro' ? 'DENTRO' : 'FUERA'}
                    </span>
                  </td>
                  <td className="px-4 md:px-5 py-3 md:py-4 hidden sm:table-cell">
                    <span className="text-sm text-text-secondary whitespace-nowrap">{formatearFecha(a.created_at)}</span>
                  </td>
                  <td className="px-4 md:px-5 py-3 md:py-4 hidden md:table-cell">
                    <span className="text-sm text-text-muted truncate max-w-[200px] block">{a.observaciones || '—'}</span>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-sm text-text-muted">No se encontraron accesos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalles */}
      {selectedAcceso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedAcceso(null)}>
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-lg font-bold text-text-primary">Detalle de Acceso</h3>
              <button onClick={() => setSelectedAcceso(null)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-border transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-text-muted font-medium">Nombre:</span>
                <span className="col-span-2 text-text-primary font-semibold">{selectedAcceso.nombre}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-text-muted font-medium">Documento:</span>
                <span className="col-span-2 text-text-secondary">{selectedAcceso.tipo_documento} {selectedAcceso.documento}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-text-muted font-medium">Tipo:</span>
                <span className="col-span-2">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${
                    selectedAcceso.tipo_entrada === 'ingreso' ? 'bg-accent/15 text-accent-bright border border-accent/20' : 'bg-danger/15 text-danger border border-danger/20'
                  }`}>
                    {selectedAcceso.tipo_entrada.toUpperCase()}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-text-muted font-medium">Fecha y Hora:</span>
                <span className="col-span-2 text-text-secondary">{formatearFecha(selectedAcceso.created_at)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-text-muted font-medium">Registrado por:</span>
                <span className="col-span-2 text-text-secondary font-medium">{selectedAcceso.usuarios?.nombre_completo || 'Vigilante (Sistema)'}</span>
              </div>

              {/* Campos dinámicos */}
              {selectedAcceso.datos_jsonb?.placa && (
                <div className="grid grid-cols-3 gap-2 border-t border-surface-border pt-3">
                  <span className="text-text-muted font-medium">Placa Vehículo:</span>
                  <span className="col-span-2 text-accent-bright font-bold tracking-widest">{selectedAcceso.datos_jsonb.placa}</span>
                </div>
              )}
              {selectedAcceso.datos_jsonb?.serial && (
                <div className="border-t border-surface-border pt-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-text-muted font-medium">Serial Equipo:</span>
                    <span className="col-span-2 text-text-secondary font-mono">{selectedAcceso.datos_jsonb.serial}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-text-muted font-medium">Marca Equipo:</span>
                    <span className="col-span-2 text-text-secondary">{selectedAcceso.datos_jsonb.marca || '—'}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-surface-border pt-3 space-y-1">
                <span className="text-text-muted font-medium block">Observaciones:</span>
                <p className="text-text-secondary bg-surface p-2.5 rounded-xl border border-surface-border min-h-[50px] leading-relaxed">
                  {selectedAcceso.observaciones || 'Sin observaciones.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
