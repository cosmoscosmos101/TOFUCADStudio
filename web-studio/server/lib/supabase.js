const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Use for public/user-scoped queries (respects RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Use for admin/server-only operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

module.exports = { supabase, supabaseAdmin }
