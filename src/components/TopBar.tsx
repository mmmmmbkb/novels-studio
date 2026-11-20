'use client';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

export default function TopBar() {
  const { user, loading, signOut, supabaseMode } = useAuth();
  return (
    <header className="topbar">
      <Link href="/" className="logo">📖 استوديو الروايات<small>MIRAX NOVELS — ميراكس للروايات</small></Link>
      <nav className="nav">
        <Link href="/leaderboard">🏆 المتصدرون</Link>
        {user && <Link href="/studio">الاستوديو</Link>}
        {user?.role === 'admin' && <Link href="/admin">🛡️ لوحة الأدمن</Link>}
        {!loading && !user && <Link href="/auth">تسجيل الدخول</Link>}
        {user && <button onClick={signOut}>خروج ({user.name})</button>}
      </nav>
      <div className="muted" style={{ width: '100%' }}>
        {supabaseMode ? '🟢 الوضع الحقيقي: Supabase متصل' : '🟡 الوضع المحلي التجريبي: اضبط متغيرات Supabase للتفعيل الحقيقي متعدد المستخدمين'}
      </div>
    </header>
  );
}
