import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [institucionActiva, setInstitucionActiva] = useState(true);
  const [diasRestantesDemo, setDiasRestantesDemo] = useState<number | null>(null);
  const [esDemo, setEsDemo] = useState(false);

  useEffect(() => {
    // Check if there is an offline session in localStorage
    if (typeof window !== 'undefined') {
      const offlineSessionRaw = localStorage.getItem('vigia_offline_session');
      if (offlineSessionRaw) {
        try {
          const parsed = JSON.parse(offlineSessionRaw);
          if (parsed && parsed.user) {
            setUser(parsed.user as User);
            setInstitucionActiva(true);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Error parsing offline session:", e);
        }
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await verificarInstitucion(currentUser);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await verificarInstitucion(currentUser);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const verificarInstitucion = async (currentUser: User) => {
    const instId = currentUser.user_metadata?.institucion_id;
    const rol = currentUser.user_metadata?.rol;

    if (!instId || rol === 'superadmin') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('instituciones')
        .select('activa, estado_suscripcion, en_demo, limite_demo')
        .eq('id', instId)
        .single();

      if (data) {
        let activa = data.activa && data.estado_suscripcion === 'activa';
        
        if (data.en_demo) {
          setEsDemo(true);
          if (data.limite_demo) {
            const limite = new Date(data.limite_demo + 'T23:59:59');
            const hoy = new Date();
            
            // Clear hours to compare days accurately
            const t1 = Date.UTC(limite.getFullYear(), limite.getMonth(), limite.getDate());
            const t2 = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
            
            const diffTime = t1 - t2;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDiasRestantesDemo(diffDays);

            if (diffDays <= 0) {
              activa = false; // Demo expired
            }
          }
        }
        
        setInstitucionActiva(activa);
      }
    } catch (err) {
      console.error('Error verifying institution:', err);
    }
    setLoading(false);
  };

  const institucionId = (user?.user_metadata?.institucion_id as string) ?? '';
  const userRol = (user?.user_metadata?.rol as string) ?? '';
  const userEmail = user?.email ?? '';

  return { 
    user, 
    loading, 
    institucionId, 
    userRol, 
    userEmail, 
    institucionActiva, 
    esDemo, 
    diasRestantesDemo 
  };
}
