import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

interface Autorizacion {
  id: string;
  tipo_objeto: string;
  serial: string;
  cantidad: number;
  autoriza_salida: boolean;
  codigo_autorizacion: string;
  creador_nombre: string;
  usada: boolean;
  created_at: string;
  usuario_nombre?: string | null;
  usuario_documento?: string | null;
}

export default function GestorAutorizaciones() {
  const { user, institucionId, loading: authLoading } = useSession();

  // States
  const [autorizaciones, setAutorizaciones] = useState<Autorizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [tipoObjeto, setTipoObjeto] = useState('Portátil');
  const [serial, setSerial] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [autorizaSalida, setAutorizaSalida] = useState(true);
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [usuarioDocumento, setUsuarioDocumento] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active people search states
  const [personasDentro, setPersonasDentro] = useState<{ nombre: string; documento: string }[]>([]);
  const [sugerencias, setSugerencias] = useState<{ nombre: string; documento: string }[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);

  useEffect(() => {
    if (!institucionId) return;
    cargarAutorizaciones();
    cargarPersonasDentro();
  }, [institucionId]);

  const cargarPersonasDentro = async () => {
    try {
      const { data } = await supabase
        .from('bitacora_accesos')
        .select('nombre, documento, tipo_entrada, created_at')
        .eq('institucion_id', institucionId)
        .order('created_at', { ascending: false });

      if (data) {
        const uniquePeople: Record<string, { nombre: string; documento: string; tipo_entrada: string }> = {};
        for (const log of data) {
          if (!uniquePeople[log.documento]) {
            uniquePeople[log.documento] = {
              nombre: log.nombre,
              documento: log.documento,
              tipo_entrada: log.tipo_entrada
            };
          }
        }

        const dentro = Object.values(uniquePeople)
          .filter(p => p.tipo_entrada === 'ingreso')
          .map(p => ({ nombre: p.nombre, documento: p.documento }));

        setPersonasDentro(dentro);
      }
    } catch (err) {
      console.error('Error loading people inside:', err);
    }
  };

  const handleNombreChange = (val: string) => {
    setUsuarioNombre(val);
    if (!val.trim()) {
      setSugerencias([]);
      setShowSugerencias(false);
      return;
    }
    const filtered = personasDentro.filter(
      p => p.nombre.toLowerCase().includes(val.toLowerCase()) || p.documento.includes(val)
    );
    setSugerencias(filtered);
    setShowSugerencias(true);
  };

  const seleccionarSugerencia = (sug: { nombre: string; documento: string }) => {
    setUsuarioNombre(sug.nombre);
    setUsuarioDocumento(sug.documento);
    setSugerencias([]);
    setShowSugerencias(false);
  };

  const cargarAutorizaciones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('autorizaciones_salida')
      .select('*')
      .eq('institucion_id', institucionId)
      .order('created_at', { ascending: false });

    if (data) setAutorizaciones(data as Autorizacion[]);
    setLoading(false);
  };

  const mostrarMensaje = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) {
      mostrarMensaje('error', 'El número de serial es obligatorio.');
      return;
    }

    setCreating(true);

    // Generate a unique 6-digit random code
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const { error } = await supabase.from('autorizaciones_salida').insert({
        institucion_id: institucionId,
        tipo_objeto: tipoObjeto,
        serial: serial.trim(),
        cantidad: cantidad,
        autoriza_salida: autorizaSalida,
        codigo_autorizacion: codigo,
        creador_id: user?.id,
        creador_nombre: user?.user_metadata?.nombre_completo || user?.email || 'Administrador',
        usada: false,
        usuario_nombre: usuarioNombre.trim() || null,
        usuario_documento: usuarioDocumento.trim() || null,
      });

      if (error) throw error;

      mostrarMensaje('success', `Autorización creada con éxito. Código: ${codigo}`);
      setSerial('');
      setCantidad(1);
      setAutorizaSalida(true);
      setUsuarioNombre('');
      setUsuarioDocumento('');
      setShowForm(false);
      cargarAutorizaciones();
    } catch (err: any) {
      console.error(err);
      mostrarMensaje('error', 'Error al crear la autorización: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = autorizaciones.filter((a) =>
    a.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.codigo_autorizacion.includes(searchQuery) ||
    a.tipo_objeto.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-6 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold animate-fade-in ${
            message.type === 'success'
              ? 'bg-accent/20 border-accent text-accent-bright'
              : 'bg-danger/20 border-danger text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Buscar por serial, código o tipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-xl pl-10 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 absolute left-3.5 top-2.5 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* New Authorization Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl px-4 py-2 text-xs transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {showForm ? 'Cancelar' : 'Nueva Autorización'}
        </button>
      </div>

      {/* Creation Form */}
      {showForm && (
        <form onSubmit={handleCrear} className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4 max-w-xl animate-slide-down">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">Crear Código de Autorización de Salida</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Tipo de Objeto</label>
              <select
                value={tipoObjeto}
                onChange={(e) => setTipoObjeto(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
              >
                <option value="Portátil">Portátil / Laptop</option>
                <option value="Herramienta">Herramienta de Trabajo</option>
                <option value="Elemento">Elemento de Valor</option>
                <option value="Maquinaria">Maquinaria</option>
                <option value="Otro">Otro objeto</option>
              </select>
            </div>
            
            <div>
              <label className="block text-2xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Número de Serial</label>
              <input
                type="text"
                placeholder="Ej. SN-847291-MX"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Cantidad</label>
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40"
              />
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autorizaSalida}
                  onChange={(e) => setAutorizaSalida(e.target.checked)}
                  className="rounded border-surface-border text-accent focus:ring-accent w-4 h-4 bg-surface"
                />
                <span className="text-xs text-text-primary font-medium">¿Autoriza la salida física?</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Nombre de la Persona (Usuario Asignado)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={usuarioNombre}
                  onChange={(e) => handleNombreChange(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                />
                {showSugerencias && sugerencias.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-surface-card border border-surface-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-surface-border/50">
                    {sugerencias.map((sug) => (
                      <button
                        key={sug.documento}
                        type="button"
                        onClick={() => seleccionarSugerencia(sug)}
                        className="w-full text-left px-3 py-2 hover:bg-accent/15 hover:text-accent-bright transition-colors text-xs flex justify-between items-center"
                      >
                        <span className="font-semibold text-text-primary">{sug.nombre}</span>
                        <span className="text-text-muted text-[10px]">Doc: {sug.documento} (Dentro)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-2xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Documento de Identificación</label>
              <input
                type="text"
                placeholder="Ej. CC 100239482"
                value={usuarioDocumento}
                onChange={(e) => setUsuarioDocumento(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl px-5 py-2.5 text-xs transition-colors disabled:opacity-50"
            >
              {creating ? 'Generando...' : 'Generar y Registrar Código'}
            </button>
          </div>
        </form>
      )}

      {/* Grid list of release authorizations */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-surface-elevated/40 text-text-secondary font-semibold">
                <th className="p-4">CÓDIGO</th>
                <th className="p-4">ELEMENTO</th>
                <th className="p-4">SERIAL</th>
                <th className="p-4">PERSONA ASIGNADA</th>
                <th className="p-4">CANTIDAD</th>
                <th className="p-4">AUTORIZADO POR</th>
                <th className="p-4">ESTADO</th>
                <th className="p-4">FECHA CREACIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-surface-elevated/20 text-text-primary">
                  <td className="p-4 font-mono font-bold text-accent-bright text-sm">{a.codigo_autorizacion}</td>
                  <td className="p-4">{a.tipo_objeto}</td>
                  <td className="p-4 font-mono text-text-secondary">{a.serial}</td>
                  <td className="p-4">
                    {a.usuario_nombre ? (
                      <div>
                        <p className="font-semibold text-text-primary">{a.usuario_nombre}</p>
                        <p className="text-[10px] text-text-muted">Doc: {a.usuario_documento || 'No registra'}</p>
                      </div>
                    ) : (
                      <span className="text-text-muted italic">— Sin asignar —</span>
                    )}
                  </td>
                  <td className="p-4 font-medium">{a.cantidad}</td>
                  <td className="p-4">{a.creador_nombre}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        a.usada
                          ? 'bg-danger/10 text-danger border border-danger/20'
                          : 'bg-accent/15 text-accent-bright border border-accent/20'
                      }`}
                    >
                      {a.usada ? 'USADO' : 'DISPONIBLE'}
                    </span>
                  </td>
                  <td className="p-4 text-text-muted">
                    {new Date(a.created_at).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-text-muted">
                    {loading ? 'Cargando autorizaciones...' : 'No se encontraron autorizaciones de salida.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
