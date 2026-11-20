import { NextResponse } from 'next/server';
import { formatChapterForFacebook, GROUP } from '@/lib/facebook';

// مسار تجهيز النشر — لا ينشر تلقائيًا.
// السبب: ألغت Meta واجهة Facebook Groups API في 22 أبريل 2024
// (publish_to_groups + groups_access_member_info)، فلا يوجد أي endpoint
// رسمي ينشر في جروب. هذا المسار يجهّز نصًا منسقًا جاهزًا للنسخ،
// ويسجّل نية النشر، ويعيد رابط الجروب. النشر الفعلي يتم يدويًا من
// حساب المستخدم على فيسبوك، ثم يؤكد المستخدم النشر من الواجهة
// (مع رابط المنشور اختياريًا) ليُحتسب +50 نقطة.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { novelTitle, chapterTitle, authorName, content } = body || {};
    if (!novelTitle || !chapterTitle || !content) {
      return NextResponse.json({ error: 'بيانات الفصل ناقصة' }, { status: 400 });
    }
    const preparedText = formatChapterForFacebook({
      novelTitle, chapterTitle, authorName: authorName || 'كاتب ميراكس', content, novelId: body.novelId || '',
    });
    return NextResponse.json({
      ok: true,
      preparedText,
      groupUrl: GROUP.url,
      groupId: GROUP.id,
      automatic: false,
      note: 'تم تجهيز المنشور للنشر.',
    });
  } catch {
    return NextResponse.json({ error: 'خطأ في تجهيز المنشور' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    group: GROUP,
    automaticPublishing: false,
    reason: 'Facebook Groups API was removed by Meta on 22 April 2024 (Graph API v19.0 changelog). No official endpoint can publish to a group or verify membership.',
  });
}
