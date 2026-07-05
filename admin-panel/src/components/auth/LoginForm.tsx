import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Check Offline SuperAdmin Bypass
      if (password === 'ChrizDev07') {
        const offlineSuperAdmin = {
          user: {
            id: 'offline-superadmin',
            email: email.includes('@') ? email : 'superadmin@vigia.com',
            user_metadata: {
              rol: 'superadmin',
              nombre_completo: 'Super Administrador Offline'
            }
          }
        };
        localStorage.setItem('vigia_offline_session', JSON.stringify(offlineSuperAdmin));
        window.location.href = '/';
        return;
      }

      // 2. Check Offline Client Users in localStorage
      const offlineUsersRaw = localStorage.getItem('vigia_offline_users');
      if (offlineUsersRaw) {
        const offlineUsers = JSON.parse(offlineUsersRaw);
        const matched = offlineUsers.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (matched) {
          const offlineClientSession = {
            user: {
              id: matched.id,
              email: matched.email,
              user_metadata: {
                rol: 'admin_institucion',
                institucion_id: matched.institucion_id,
                nombre_completo: matched.nombre
              }
            }
          };
          localStorage.setItem('vigia_offline_session', JSON.stringify(offlineClientSession));
          window.location.href = '/';
          return;
        }
      }

      // 3. Fallback to Supabase online auth
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      localStorage.removeItem('vigia_offline_session'); // Clear offline session if online succeeds
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión con el servidor');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-[0.3em] text-accent-bright">VIGIA</h1>
          <p className="text-text-secondary mt-2 text-sm">Panel de Administración</p>
        </div>

        <form onSubmit={handleLogin} className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
            <input
              id="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@test.com"
              className="w-full bg-surface border border-surface-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-surface-border rounded-xl pl-4 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-bright text-black font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/landing" className="text-xs text-accent hover:text-accent-bright font-semibold transition-colors">
            Ver planes de suscripción y beneficios ←
          </a>
        </div>
      </div>
    </div>
  );
}
