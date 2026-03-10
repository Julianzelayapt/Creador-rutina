import { createClient } from '@supabase/supabase-js';

// Use environment variables for better flexibility and security.
// In Vite, these are accessed via import.meta.env.
// On Vercel, you should set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project settings.
const supabaseUrl = 'https://cdcjwmhkdbcoqeqkjoty.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY2p3bWhrZGJjb3FlcWtqb3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTE1NzEsImV4cCI6MjA4NTE2NzU3MX0.Pad0ddWj8dj1H1XT3N99aj3Nzb149fkBdvA9sIcafnY'; // Add your actual anon key here or in Vercel

export const supabase = createClient(supabaseUrl, supabaseKey);
