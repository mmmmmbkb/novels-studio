// ── عميل Supabase — يعمل فقط عند ضبط متغيرات البيئة ────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CONFIGURED =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http') &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 10;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return client;
}

export const ADMIN_EMAIL =
  (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase() || '';
