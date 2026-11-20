import { NextResponse } from 'next/server';
import { requireUser, serviceClient } from '@/lib/admin-server';

// دعوة أدمن سرية: POST { code } — يقارن الكود مع ADMIN_INVITE_CODE
// (متغير خادم فقط، ليس NEXT_PUBLIC_ حتى لا يظهر في حزمة المتصفح).
// إن طابق، يمنح المستخدم المسجّل دخوله دور admin + عضوية معتمدة.
export async function POST(req: Request) {
  const check = await requireUser(req);
  if (!check.ok) return NextResponse.json({ error: check.error || 'ممنوع' }, { status: check.status });
  try {
    const inviteCode = process.env.ADMIN_INVITE_CODE || '';
    if (!inviteCode) return NextResponse.json({ error: 'الرابط غير صحيح' }, { status: 400 });
    const body = (await req.json()) as { code?: unknown };
    const code = String(body.code || '').trim();
    if (!code || code !== inviteCode) {
      return NextResponse.json({ error: 'الرابط غير صحيح' }, { status: 400 });
    }
    const svc = serviceClient();
    const { error } = await svc
      .from('profiles')
      .update({ role: 'admin', membership_status: 'approved' })
      .eq('id', check.userId as string);
    if (error) return NextResponse.json({ error: 'الرابط غير صحيح' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'الرابط غير صحيح' }, { status: 400 });
  }
}
