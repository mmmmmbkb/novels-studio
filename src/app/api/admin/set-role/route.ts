import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient, isMainAdminEmail } from '@/lib/admin-server';

export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error || 'ممنوع' }, { status: check.status });
  try {
    const body = (await req.json()) as { email?: unknown; role?: unknown };
    const email = String(body.email || '').trim().toLowerCase();
    const role = body.role === 'admin' || body.role === 'member' ? body.role : '';
    if (!email || !role) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });

    // حماية الأدمن الرئيسي ونفس الأدمن من إزالة الدور عن أنفسهم
    if (role === 'member') {
      if (isMainAdminEmail(email)) {
        return NextResponse.json({ error: 'لا يمكن إزالة دور الأدمن عن الأدمن الرئيسي' }, { status: 403 });
      }
      if (check.email && email === check.email) {
        return NextResponse.json({ error: 'لا يمكنك إزالة دور الأدمن عن نفسك' }, { status: 403 });
      }
    }

    const svc = serviceClient();
    const { data: target, error: findErr } = await svc
      .from('profiles')
      .select('id,email,name,role,membership_status')
      .eq('email', email)
      .single();
    if (findErr || !target) {
      return NextResponse.json({ error: 'لا يوجد حساب مسجّل بهذا الإيميل في الموقع' }, { status: 404 });
    }

    const patch: Record<string, unknown> = { role };
    if (role === 'admin') patch.membership_status = 'approved';
    const { error } = await svc.from('profiles').update(patch).eq('id', String((target as Record<string, unknown>).id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 });
  }
}
