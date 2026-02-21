import { createClient } from '@supabase/supabase-js';

// Use environment variables for better flexibility and security.
// In Vite, these are accessed via import.meta.env.
// On Vercel, you should set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project settings.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hqslhcvahauodljbiuty.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxc2xoY3ZhaGF1b2RsamJpdXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjgxNDAsImV4cCI6MjA4NDcwNDE0MH0.dXB8-LVToWAVBfllMXPG36BLXCN_VyjNc1VVEQcUylY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
