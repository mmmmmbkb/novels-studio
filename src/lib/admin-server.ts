// ── أدوات خادم للأدمن — server-only ─────────────────────────────────────
// تُستخدم حصريًا من routes في src/app/api/admin/.
// التحقق: Bearer token من Supabase Auth → ثم التأكد أن المستخدم أدمن
// (إيميله = NEXT_PUBLIC_ADMIN_EMAIL أو role='admin' في profiles).
// كل الكتابة/القراءة الحساسة تتم عبر service role (يتجاوز RLS بأمان)،
// ومفتاح الخدمة لا يصل أبدًا إلى حزمة المتصفح.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL } from './supabase';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function serviceClient(): SupabaseClient {
  if (!URL || !SERVICE_KEY) throw new Error('Service role غير مضبوط');
  return createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface AdminCheck {
  ok: boolean;
  status: number;
  userId?: string;
  email?: string;
  error?: string;
}

/** يتحقق من Bearer token ويعيد المستخدم إن كان أدمنًا، وإلا سبب الرفض. */
export async function requireAdmin(req: Request): Promise<AdminCheck> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'غير مسجّل دخول' };
  if (!URL || !ANON_KEY || !SERVICE_KEY) return { ok: false, status: 500, error: 'الخادم غير مضبوط' };

  const { data, error } = await anonClient().auth.getUser(token);
  const user = data?.user;
  if (error || !user || !user.email) return { ok: false, status: 401, error: 'جلسة غير صالحة' };

  const email = user.email.toLowerCase();
  if (ADMIN_EMAIL && email === ADMIN_EMAIL) return { ok: true, status: 200, userId: user.id, email };

  const svc = serviceClient();
  const { data: prof } = await svc.from('profiles').select('role').eq('id', user.id).single();
  if ((prof as Record<string, unknown> | null)?.role === 'admin') {
    return { ok: true, status: 200, userId: user.id, email };
  }
  return { ok: false, status: 403, error: 'ليس لديك صلاحية' };
}

/** يتحقق من Bearer token فقط (لأي مستخدم مسجّل دخول) — لدعوة الأدمن. */
export async function requireUser(req: Request): Promise<AdminCheck> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'غير مسجّل دخول' };
  if (!URL || !ANON_KEY) return { ok: false, status: 500, error: 'الخادم غير مضبوط' };
  const { data, error } = await anonClient().auth.getUser(token);
  const user = data?.user;
  if (error || !user || !user.email) return { ok: false, status: 401, error: 'جلسة غير صالحة' };
  return { ok: true, status: 200, userId: user.id, email: user.email.toLowerCase() };
}

export function isMainAdminEmail(email: string): boolean {
  return !!ADMIN_EMAIL && email.trim().toLowerCase() === ADMIN_EMAIL;
}
