import { createClient } from '@supabase/supabase-js';

// Use environment variables for better flexibility and security.
// In Vite, these are accessed via import.meta.env.
// On Vercel, you should set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project settings.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cdcjwmhkdbcoqeqkjoty.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''; // Add your actual anon key here or in Vercel

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
