import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'https://wkrpdhptbnnagrxxhxxj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrcnBkaHB0Ym5uYWdyeHhoeHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzMxOTQsImV4cCI6MjA3NDYwOTE5NH0._8kAOFimL5bM0nBmTMynFjpnJvNuEnlm5KBA5N0AjvE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})