'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import { getDB, isSupabaseMode } from '@/lib/db';

function AuthForm() {
  const router = useRouter();
  const { refresh, supabaseMode } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const db = getDB();
      if (mode === 'signup') {
        if (password.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل.');
        await db.signUp(email, password, name);
      } else {
        await db.signIn(email, password);
      }
      await refresh(); router.push('/studio');
    } catch (err) { setError(err instanceof Error ? err.message : 'حدث خطأ'); } finally { setBusy(false); }
  }

  async function facebookLogin() {
    setError(''); setBusy(true);
    try {
      if (!isSupabaseMode()) {
        throw new Error('تسجيل الدخول بفيسبوك يحتاج الوضع الحقيقي: اضبط NEXT_PUBLIC_SUPABASE_URL وفعّل Facebook Provider في Supabase (انظر README القسم 4). حاليًا يمكنك التسجيل بالإيميل ثم ربط بروفايل فيسبوك من صفحة التحقق.');
      }
      await getDB().signInWithFacebook();
    } catch (err) { setError(err instanceof Error ? err.message : 'حدث خطأ'); } finally { setBusy(false); }
  }

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <h1>{mode === 'signup' ? 'إنشاء حساب كاتب' : 'تسجيل الدخول'}</h1>
        <p>حسابك الخاص: رواياتك وفصولك ونقاطك محفوظة باسمك ومنفصلة عن باقي الكتّاب.</p>
        {error && <div className="alert red">{error}</div>}
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field"><label>الاسم (اسم الكاتب)</label><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثال: محمود" /></div>
          )}
          <div className="field"><label>الإيميل</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" style={{ textAlign: 'left' }} placeholder="you@example.com" /></div>
          <div className="field"><label>كلمة المرور</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" style={{ textAlign: 'left' }} placeholder="6 أحرف على الأقل" /></div>
          <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'جاري...' : mode === 'signup' ? 'إنشاء الحساب' : 'دخول'}</button>
        </form>
        <div style={{ textAlign: 'center', margin: '14px 0' }} className="muted">— أو —</div>
        <button className="btn ghost" onClick={facebookLogin} disabled={busy} style={{ width: '100%' }}>
          {supabaseMode ? '🔵 المتابعة بحساب فيسبوك' : '🔵 المتابعة بحساب فيسبوك (يحتاج Supabase — انظر الملاحظة)'}
        </button>
        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn ghost small" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
            {mode === 'signup' ? 'عندك حساب؟ سجّل دخول' : 'جديد هنا؟ أنشئ حسابًا'}
          </button>
        </p>
        <div className="alert" style={{ marginTop: 16 }}>
          بعد إنشاء الحساب ستحتاج <strong>التحقق من عضوية جروب ميراكس</strong>: اربط رابط بروفايل فيسبوك الخاص بك من داخل الاستوديو، وسيوافق الأدمن على طلبك يدويًا — لأن فيسبوك ألغى Groups API في 2024 ولا يوجد تحقق تلقائي من العضوية.
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return <AuthProvider><TopBar /><AuthForm /></AuthProvider>;
}
