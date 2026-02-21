import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hqslhcvahauodljbiuty.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxc2xoY3ZhaGF1b2RsamJpdXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjgxNDAsImV4cCI6MjA4NDcwNDE0MH0.dXB8-LVToWAVBfllMXPG36BLXCN_VyjNc1VVEQcUylY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
