'use client';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import { getDB } from '@/lib/db';
import type { MembershipRequest } from '@/lib/types';
import { GROUP } from '@/lib/facebook';

function AdminInner() {
  const { user, loading } = useAuth();
  const [reqs, setReqs] = useState<MembershipRequest[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() { setReqs(await getDB().listMembershipRequests()); }
  useEffect(() => { load(); }, []);

  async function review(id: string, approved: boolean) {
    if (!user) return;
    try { await getDB().reviewMembership(id, approved, user.name); setMsg(approved ? '✅ تمت الموافقة على العضوية' : '❌ تم رفض الطلب'); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'خطأ'); }
  }

  if (loading) return <main className="container"><p>جاري التحميل...</p></main>;
  if (!user) return <main className="container"><div className="card"><h1>سجّل دخول أولًا</h1></div></main>;
  if (user.role !== 'admin') return <main className="container"><div className="card"><h1>🛡️ لوحة الأدمن</h1><p>هذه الصفحة للأدمن فقط (محمود، أدمن جروب ميراكس).</p></div></main>;

  const pending = reqs.filter((r) => r.status === 'pending');
  return (
    <main className="container">
      <h1>🛡️ لوحة تحكم الأدمن — التحقق من العضوية</h1>
      <p>جروب: <a href={GROUP.url} target="_blank" rel="noreferrer">{GROUP.name}</a> — {GROUP.membersApprox} عضو</p>
      <p className="muted">افتح رابط بروفايل فيسبوك لكل طالب وتأكد من عضويته في الجروب، ثم وافق أو ارفض هنا. الموافقة تفتح الاستوديو لذلك المستخدم فورًا.</p>
      {msg && <div className="alert green">{msg}</div>}
      {err && <div className="alert red">{err}</div>}
      <h2>⏳ طلبات بانتظار المراجعة ({pending.length})</h2>
      {pending.length === 0 && <p className="muted">لا طلبات معلّقة حاليًا.</p>}
      {pending.map((r) => (
        <div key={r.id} className="card">
          <div className="space"><strong>{r.userName}</strong><span className="badge gold">بانتظار</span></div>
          <p className="muted">{r.userEmail} · {new Date(r.createdAt).toLocaleString('ar-EG')}</p>
          {r.note && <p>📝 {r.note}</p>}
          <div className="row">
            <a href={r.facebookUrl} target="_blank" rel="noreferrer"><button className="btn ghost small" type="button">فتح بروفايل فيسبوك ↗</button></a>
            <button className="btn small" onClick={() => review(r.id, true)}>✅ موافقة</button>
            <button className="btn danger small" onClick={() => review(r.id, false)}>❌ رفض</button>
          </div>
        </div>
      ))}
      <h2>📋 كل الطلبات ({reqs.length})</h2>
      <table><thead><tr><th>الاسم</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
        {reqs.map((r) => <tr key={r.id}><td>{r.userName}</td><td>{r.status === 'approved' ? '✅ مقبول' : r.status === 'rejected' ? '❌ مرفوض' : '⏳ بانتظار'}</td><td className="muted">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</td></tr>)}
      </tbody></table>
    </main>
  );
}

export default function AdminPage() {
  return <AuthProvider><TopBar /><AdminInner /></AuthProvider>;
}
