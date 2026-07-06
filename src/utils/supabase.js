import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Must use the @supabase/ssr browser client (not plain @supabase/supabase-js)
// so the session is stored in cookies — middleware.js reads the session via
// createServerClient, which only sees cookies, not localStorage.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Resolves the signed-in user's role from the `profiles` table (never from
// the email string). Returns null if there is no session.
export async function getCurrentProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', session.user.id)
    .single();

  return profile ? { ...profile, user: session.user } : null;
}