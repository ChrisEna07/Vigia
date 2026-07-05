process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tmfdvbnbcyzeicodmplr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZmR2Ym5iY3l6ZWljb2RtcGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDAwMjAsImV4cCI6MjA5ODQxNjAyMH0.hCoTnVibv4NXZH-gC7RaqBZF3BSoI6Qpy16MSKbhixU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Signing in as Super Admin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'chrizdev07@gmail.com',
    password: 'ChrizDev07*'
  });

  if (authError) {
    console.error("Sign in failed:", authError);
    return;
  }
  console.log("Signed in successfully as:", authData.user.email);

  console.log("\nFetching last 10 messages...");
  const { data: msgs, error: e1 } = await supabase.from('mensajes').select('*').order('created_at', { ascending: false }).limit(10);
  if (e1) {
    console.error("Error fetching messages:", e1);
    return;
  }
  console.log("MESSAGES:", JSON.stringify(msgs, null, 2));

  console.log("\nFetching users...");
  const { data: users, error: e2 } = await supabase.from('usuarios').select('id, nombre_completo, email, institucion_id, rol');
  if (e2) {
    console.error("Error fetching users:", e2);
    return;
  }
  console.log("USERS:", JSON.stringify(users, null, 2));
}

run();
