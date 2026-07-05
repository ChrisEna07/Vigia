import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/auth';

const links = [
  { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/accesos', label: 'Accesos', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href: '/autorizaciones', label: 'Autorizaciones', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { href: '/novedades', label: 'Novedades', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { href: '/mensajeria', label: 'Mensajería', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { href: '/usuarios', label: 'Vigilantes', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
  { href: '/soporte', label: 'Soporte', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/configuracion', label: 'Configuración', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
];

export default function Sidebar({ currentPath = '/' }: { currentPath?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, userEmail, userRol, loading, institucionId, institucionActiva, esDemo, diasRestantesDemo } = useSession();
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!institucionId || !user?.id || userRol === 'superadmin') return;

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('institucion_id', institucionId)
        .neq('remitente_id', user.id)
        .eq('leido', false);
      
      setUnreadChatCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('sidebar-unread-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mensajes',
        filter: `institucion_id=eq.${institucionId}`,
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [institucionId, user?.id, userRol]);

  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkDbStatus = async () => {
      try {
        const { error } = await supabase.from('instituciones').select('id').limit(1);
        if (error) throw error;
        setDbOnline(true);
      } catch (err) {
        setDbOnline(false);
      }
    };

    checkDbStatus();
    const interval = setInterval(checkDbStatus, 8000);

    const handleOnline = () => setDbOnline(true);
    const handleOffline = () => setDbOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const menuLinks = loading
    ? []
    : userRol === 'superadmin'
      ? [
          { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
          { href: '/clientes', label: 'Clientes', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
          { href: '/soporte', label: 'Soporte', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z' },
        ]
      : !institucionActiva
        ? [
            { href: '/soporte', label: 'Soporte Comercial', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z' }
          ]
        : [...links];

  const isActive = (href: string) => currentPath === href;

  const triggerLogoutConfirm = () => {
    setShowConfirmLogout(true);
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vigia_offline_session');
    }
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-50 lg:hidden w-12 h-12 rounded-full bg-accent text-black shadow-lg flex items-center justify-center"
        aria-label="Abrir menú"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-surface-elevated border-r border-surface-border flex flex-col py-6 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex items-center justify-between px-4 mb-10">
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-widest text-accent-bright whitespace-nowrap">VIGIA</h1>
              <div className="flex items-center gap-1.5 mt-0.5 select-none">
                <span className="relative flex h-2 w-2">
                  {dbOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    dbOnline === null ? 'bg-amber-500' : dbOnline ? 'bg-green-500' : 'bg-red-500'
                  }`}></span>
                </span>
                <span className="text-[10px] font-semibold text-text-muted">
                  {dbOnline === null ? 'Conectando...' : dbOnline ? 'DB Online' : 'DB Offline'}
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-1">
            <button onClick={() => setMobileOpen(false)} className="lg:hidden p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-border" aria-label="Cerrar menú">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-border" aria-label={collapsed ? 'Expandir' : 'Colapsar'}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {!collapsed && esDemo && diasRestantesDemo !== null && diasRestantesDemo > 0 && (
          <div className="mx-4 mb-4 p-3 bg-amber-500/10 border border-amber-500/35 rounded-xl text-[10px] text-amber-500 leading-normal animate-pulse shrink-0">
            <span className="font-bold">⚠️ Prueba Demo de 20 Días</span><br />
            Expira en <span className="font-bold">{diasRestantesDemo} {diasRestantesDemo === 1 ? 'día' : 'días'}</span>. Comunícate para contratar tu plan definitivo.
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3">
          {menuLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  active ? 'bg-accent/10 text-accent-bright font-semibold' : 'text-text-secondary hover:bg-surface-border hover:text-text-primary'
                }`}
                title={collapsed ? link.label : undefined}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
                {!collapsed && <span className="text-sm whitespace-nowrap">{link.label}</span>}
                {link.label === 'Mensajería' && unreadChatCount > 0 && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-600 rounded-full w-2.5 h-2.5 animate-pulse" />
                )}
              </a>
            );
          })}
        </nav>

        {/* User info + logout */}
        {!collapsed && !loading && userEmail && (
          <div className="px-4 mt-4 pt-4 border-t border-surface-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 ring-2 ring-accent/30">
                  <span className="text-xs font-bold text-accent-bright">{userEmail.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-xs text-text-muted truncate">{userEmail}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleTheme} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-border transition-colors" title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}>
                  {theme === 'light' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                  )}
                </button>
                <button onClick={triggerLogoutConfirm} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Cerrar sesión">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Blocking overlay if subscription is expired */}
      {!loading && !institucionActiva && userRol !== 'superadmin' && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-card border border-danger/30 rounded-3xl p-8 text-center max-w-md w-full space-y-6 shadow-2xl text-text-primary">
            <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto text-danger animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-primary">Servicio Suspendido</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Tu suscripción mensual o periodo de prueba demo de 20 días ha expirado. Por seguridad y control de datos, las funciones de control de acceso web y móviles han sido deshabilitadas.
              </p>
            </div>
            <div className="p-4 bg-surface rounded-2xl border border-surface-border text-[11px] text-text-secondary">
              Ponte en contacto con el equipo comercial de **Vigia** para renovar tu suscripción o activar tu plan definitivo.
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="https://wa.me/573225877854?text=Hola%20Vigia,%20mi%20suscripcion%20de%20empresa%20ha%20vencido%20y%20deseo%20renovarla."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-accent hover:bg-accent-bright text-black font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg text-xs"
              >
                Contactar Soporte Comercial
              </a>
              <button
                onClick={handleLogout}
                className="bg-surface-elevated hover:bg-surface-border text-text-primary font-bold py-2 px-4 rounded-xl transition-all text-xs border border-surface-border"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmLogout && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-fade-in text-text-primary">
            <h3 className="text-md font-bold text-text-primary">¿Cerrar Sesión?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">¿Estás seguro de que deseas salir del panel de control Vigia?</p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowConfirmLogout(false)}
                className="px-4 py-2 rounded-xl border border-surface-border text-xs font-semibold hover:bg-surface-elevated text-text-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="bg-danger hover:bg-danger/90 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                Sí, Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
