// ── فيسبوك / جروب ميراكس — حقائق موثقة، لا وعود كاذبة ────────────────
// المصدر: Meta Graph API changelog v19.0 (23 يناير 2024) — أُلغيت
// Facebook Groups API بالكامل في 22 أبريل 2024 من كل إصدارات Graph API،
// ومعها الصلاحيتان publish_to_groups و groups_access_member_info،
// ولم يعد بإمكان أدمن الجروب تثبيت أي تطبيق داخل الجروب.
// النتيجة العملية:
//  • لا يوجد أي API رسمي يقرأ قائمة أعضاء الجروب أو يتحقق من عضوية مستخدم.
//  • لا يوجد أي API رسمي ينشر في الجروب نيابة عن مستخدم.
//  • ما زال Facebook Login يعمل لإثبات هوية المستخدم (public_profile + email)
//    عبر Supabase Auth، وهذا ما نستخدمه + طلب تحقق يوافق عليه الأدمن يدويًا.
//  • النشر يتم بتجهيز نص منسق + نسخ + فتح الجروب، وينشره المستخدم/الأدمن بنفسه.

export const GROUP = {
  id: '918194596679289',
  name: 'MIRAX NOVELS - ميراكس للروايات',
  url: 'https://www.facebook.com/groups/918194596679289/',
  membersApprox: '~70,000',
  privacy: 'خاص (Private)',
} as const;

export function groupPostUrl(): string {
  return GROUP.url;
}

export function formatChapterForFacebook(opts: {
  novelTitle: string;
  chapterTitle: string;
  authorName: string;
  content: string;
  novelId: string;
}): string {
  const excerpt = opts.content.slice(0, 1500);
  return [
    `📖 ${opts.novelTitle} — ${opts.chapterTitle}`,
    `✍️ بقلم: ${opts.authorName}`,
    '',
    excerpt,
    '',
    '—',
    'نُشر من تطبيق «استوديو الروايات» — مجتمع ميراكس للروايات',
    '#ميراكس_للروايات',
    `رابط الجروب: ${GROUP.url}`,
  ].join('\n');
}

export function isFacebookProfileUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return /(^|\.)facebook\.com$/.test(u.hostname) && u.pathname.length > 1;
  } catch {
    return false;
  }
}
