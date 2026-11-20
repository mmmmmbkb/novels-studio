import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/admin-server';

// GET /api/admin/requests — كل طلبات العضوية (الأدمن فقط، عبر service role)
export async function GET(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error || 'ممنوع' }, { status: check.status });
  try {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('membership_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      requests: (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        userId: String(r.user_id),
        userName: String(r.user_name),
        userEmail: String(r.user_email),
        facebookUrl: String(r.facebook_url),
        note: (r.note as string) || null,
        status: (r.status as string) || 'pending',
        reviewedBy: (r.reviewed_by as string) || null,
        createdAt: String(r.created_at),
        reviewedAt: (r.reviewed_at as string) || null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 });
  }
}
