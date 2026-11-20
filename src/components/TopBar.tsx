'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { getDB } from '@/lib/db';

export default function TopBar() {
  const { user, loading, signOut } = useAuth();
  const [pending, setPending] = useState(0);

  // شارة إشعار للأدمن فقط: عدد طلبات العضوية بانتظار المراجعة
  useEffect(() => {
    if (user?.role !== 'admin') { setPending(0); return; }
    let alive = true;
    getDB().listMembershipRequestsAdmin()
      .then((reqs) => { if (alive) setPending(reqs.filter((r) => r.status === 'pending').length); })
      .catch(() => { if (alive) setPending(0); });
    return () => { alive = false; };
  }, [user?.role]);

  return (
    <header className="topbar">
      <Link href="/" className="logo">📖 استوديو الروايات<small>MIRAX NOVELS — ميراكس للروايات</small></Link>
      <nav className="nav">
        <Link href="/leaderboard">🏆 المتصدرون</Link>
        {user && <Link href="/studio">الاستوديو</Link>}
        {user?.role === 'admin' && <Link href="/admin">🛡️ لوحة الأدمن</Link>}
        {user?.role === 'admin' && pending > 0 && (
          <Link href="/admin" className="badge gold" title="طلبات عضوية بانتظار المراجعة">
            🔔 طلبات بانتظار المراجعة ({pending})
          </Link>
        )}
        {!loading && !user && <Link href="/auth">تسجيل الدخول</Link>}
        {user && <button onClick={signOut}>خروج ({user.name})</button>}
      </nav>
    </header>
  );
}
