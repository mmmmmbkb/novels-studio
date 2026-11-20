import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/admin-server';

export async function GET(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error || 'ممنوع' }, { status: check.status });
  try {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('profiles')
      .select('id,email,name,role,membership_status')
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      users: (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        email: String(r.email || ''),
        name: String(r.name || ''),
        role: (r.role as string) || 'member',
        membershipStatus: (r.membership_status as string) || 'none',
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 });
  }
}
