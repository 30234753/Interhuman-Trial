import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for server-side usage (API routes, server components)
 * @returns Configured Supabase client instance
 * @throws Error if required environment variables are not set
 */
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Creates a Supabase client for client-side usage (client components)
 * Uses environment variables that are prefixed with NEXT_PUBLIC_ to be available in the browser
 * @returns Configured Supabase client instance
 * @throws Error if required environment variables are not set
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}