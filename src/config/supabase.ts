import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://flbapvoppnlnvrrgkxli.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsYmFwdm9wcG5sbnZycmdreGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNzE2NTAsImV4cCI6MjA3Mjg0NzY1MH0.i7F9RQrWlp_cmfzUH_oykni2XB2v3UoI1rUXC7yl4_c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
