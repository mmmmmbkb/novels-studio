import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/admin-server';

// POST /api/admin/review — الموافقة/الرفض على طلب عضوية (الأدمن فقط، عبر service role)
export async function POST(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error || 'ممنوع' }, { status: check.status });
  try {
    const body = (await req.json()) as { id?: unknown; approved?: unknown; reviewer?: unknown };
    const id = String(body.id || '').trim();
    if (!id || typeof body.approved !== 'boolean') {
      return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    }
    const approved = body.approved as boolean;
    const reviewer = String(body.reviewer || check.email || '').trim();

    const svc = serviceClient();
    const { data, error } = await svc
      .from('membership_requests')
      .update({ status: approved ? 'approved' : 'rejected', reviewed_by: reviewer || null, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || 'الطلب غير موجود' }, { status: 404 });

    // تحديث حالة العضوية في بروفايل صاحب الطلب
    await svc.from('profiles').update({ membership_status: approved ? 'approved' : 'rejected' }).eq('id', String((data as Record<string, unknown>).user_id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 });
  }
}
