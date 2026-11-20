import { NextResponse } from 'next/server';
import { requireUser, serviceClient } from '@/lib/admin-server';

// GET /api/me — يعيد صف profiles الخاص بالمستخدم المسجّل دخوله.
// يقرأ عبر service role (يتجاوز RLS) بعد التحقق من Bearer token،
// حتى يصل الدور الحقيقي (role) من قاعدة البيانات إلى المتصفح،
// لأن القراءة المباشرة من المتصفح عبر عميل anon قد لا تعيد الصف
// أو تعيد نسخة لا تطابق role المخزّن فعلًا.
export async function GET(req: Request) {
  const check = await requireUser(req);
  if (!check.ok) return NextResponse.json({ error: check.error || 'غير مسجّل دخول' }, { status: check.status });
  try {
    const svc = serviceClient();
    const { data, error } = await svc
      .from('profiles')
      .select('id,email,name,facebook_id,facebook_url,facebook_name,membership_status,role,points,created_at')
      .eq('id', check.userId as string)
      .single();
    if (error || !data) {
      // لا يوجد صف profiles بعد — أعد بيانات أساسية من جلسة Auth
      return NextResponse.json({
        profile: {
          id: check.userId,
          email: check.email || '',
          name: (check.email || '').split('@')[0] || 'كاتب',
          role: 'member',
          membershipStatus: 'none',
          points: 0,
          facebook_url: null,
        },
      });
    }
    const r = data as Record<string, unknown>;
    return NextResponse.json({
      profile: {
        id: String(r.id),
        email: String(r.email || ''),
        name: String(r.name || r.email || 'كاتب'),
        facebookId: (r.facebook_id as string) || null,
        facebookUrl: (r.facebook_url as string) || null,
        facebookName: (r.facebook_name as string) || null,
        membershipStatus: (r.membership_status as string) || 'none',
        role: (r.role as string) || 'member',
        points: Number(r.points || 0),
        createdAt: String(r.created_at || ''),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 });
  }
}
