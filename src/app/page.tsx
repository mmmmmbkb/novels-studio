import Link from 'next/link';
import { AuthProvider } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import { GROUP } from '@/lib/facebook';

export default function Home() {
  return (
    <AuthProvider>
      <TopBar />
      <main className="container">
        <div className="card" style={{ textAlign: 'center', padding: 36 }}>
          <h1 style={{ fontSize: 38 }}>📖 استوديو الروايات</h1>
          <p style={{ fontSize: 18 }}>منصة احترافية لكتابة الروايات — حساب خاص لكل كاتب، رواياته وفصوله ونقاطه محفوظة باسمه.</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <Link href="/auth"><button className="btn gold">ابدأ الكتابة — إنشاء حساب</button></Link>
            <Link href="/leaderboard"><button className="btn ghost">🏆 لوحة المتصدرين</button></Link>
          </div>
        </div>

        <div className="alert">
          <strong>⚠️ حدود فيسبوك الحقيقية — اقرأ قبل التسجيل:</strong><br />
          ألغت Meta واجهة Facebook Groups API نهائيًا في <strong>22 أبريل 2024</strong> (مع صلاحيتي
          publish_to_groups و groups_access_member_info)، ولم يعد بإمكان أي تطبيق — بما فيه هذا —
          قراءة قائمة أعضاء الجروب أو التحقق تلقائيًا من عضوية أي شخص، أو النشر في الجروب عبر API.
          لذلك التحقق هنا يتم هكذا: تسجّل دخول (إيميل أو فيسبوك لإثبات هويتك)، تربط رابط بروفايل فيسبوك الخاص بك،
          ويراجع الأدمن طلبك ويوافق عليه يدويًا داخل لوحة التحكم. والنشر في الجروب يتم بتجهيز المنشور وفتح الجروب لتنشره بنفسك.
        </div>

        <div className="grid">
          <div className="card"><h3>✍️ محرر فصول احترافي</h3><p>كتابة بخط عربي مريح، عدّاد كلمات حي، حفظ تلقائي، ونقاط على كل إنجاز.</p></div>
          <div className="card"><h3>📚 مكتبة رواياتك</h3><p>روايات منظمة بأغلفة ملوّنة أو صورة غلاف ترفعها من جهازك (JPG/PNG/WebP حتى 8MB).</p></div>
          <div className="card"><h3>🖨️ تصدير PDF</h3><p>صدّر أي رواية كاملة كملف PDF للطباعة أو المشاركة خارج فيسبوك.</p></div>
          <div className="card"><h3>⭐ نظام نقاط ومستويات</h3><p>نشر فصل +50 · فصل جديد +10 · +5 لكل 500 كلمة · +2 لكل تفاعل · +5 لكل تعليق.</p></div>
          <div className="card"><h3>🔐 حساب لكل كاتب</h3><p>إيميل + كلمة مرور، أو تسجيل دخول بفيسبوك (عند ضبط Supabase). بياناتك منفصلة تمامًا عن باقي الكتّاب.</p></div>
          <div className="card"><h3>👥 جروب ميراكس</h3><p>مجموعة <a href={GROUP.url} target="_blank" rel="noreferrer">{GROUP.name}</a> — {GROUP.privacy}، {GROUP.membersApprox} عضو. الدخول للاستوديو بعد موافقة الأدمن على عضويتك.</p></div>
        </div>
      </main>
    </AuthProvider>
  );
}
