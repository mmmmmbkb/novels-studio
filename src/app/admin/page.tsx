'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import { getDB, isAdminEmail } from '@/lib/db';
import type { MembershipRequest, Profile } from '@/lib/types';
import { GROUP } from '@/lib/facebook';

function AdminInner() {
  const { user, loading, refresh } = useAuth();
  const searchParams = useSearchParams();
  const [reqs, setReqs] = useState<MembershipRequest[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const inviteHandled = useRef(false);

  async function load() { setReqs(await getDB().listMembershipRequestsAdmin()); }
  async function loadUsers() {
    try { setUsers(await getDB().listAdminUsers()); } catch { setUsers([]); }
  }

  // رابط الدعوة السري: ?invite=CODE — يُرسل تلقائيًا للخادم مرة واحدة
  useEffect(() => {
    const code = searchParams.get('invite');
    if (!code || !user || inviteHandled.current) return;
    inviteHandled.current = true;
    window.history.replaceState({}, '', '/admin');
    getDB().claimAdminInvite(code)
      .then(async () => {
        setMsg('✅ تم منحك صلاحية الأدمن');
        await refresh();
        await loadUsers();
      })
      .catch(() => { setErr('الرابط غير صحيح'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id]);

  useEffect(() => {
    if (user?.role === 'admin') { load(); loadUsers(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  async function review(id: string, approved: boolean) {
    if (!user) return;
    try { await getDB().reviewMembershipAdmin(id, approved, user.name); setMsg(approved ? '✅ تمت الموافقة على العضوية' : '❌ تم رفض الطلب'); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'خطأ'); }
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault(); if (!newAdminEmail.trim() || busy) return;
    setErr(''); setMsg(''); setBusy(true);
    try {
      await getDB().setUserRole(newAdminEmail.trim(), 'admin');
      setMsg('✅ تمت إضافة الأدمن');
      setNewAdminEmail('');
      await loadUsers();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); } finally { setBusy(false); }
  }

  async function removeAdmin(email: string) {
    setErr(''); setMsg('');
    try {
      await getDB().setUserRole(email, 'member');
      setMsg('تمت إزالة الأدمن');
      await loadUsers();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); }
  }

  if (loading) return <main className="container"><p>جاري التحميل...</p></main>;
  if (!user) return <main className="container"><div className="card"><h1>سجّل دخول أولًا</h1></div></main>;
  // رسالة عامة لغير الأدمن — بلا أي تفاصيل عن الأدمن أو الطلبات
  if (user.role !== 'admin') return <main className="container"><div className="card"><h1>هذه الصفحة غير متاحة</h1><p className="muted">الصفحة التي تبحث عنها غير موجودة أو غير متاحة لك.</p></div></main>;

  const pending = reqs.filter((r) => r.status === 'pending');
  const admins = users.filter((u) => u.role === 'admin');
  return (
    <main className="container">
      <h1>🛡️ لوحة تحكم الأدمن — التحقق من العضوية</h1>
      <p>جروب: <a href={GROUP.url} target="_blank" rel="noreferrer">{GROUP.name}</a> — {GROUP.membersApprox} عضو</p>
      <p className="muted">افتح رابط بروفايل فيسبوك لكل طالب وتأكد من عضويته في الجروب، ثم وافق أو ارفض هنا. الموافقة تفتح الاستوديو لذلك المستخدم فورًا.</p>
      {msg && <div className="alert green">{msg}</div>}
      {err && <div className="alert red">{err}</div>}
      <div className="space" style={{ alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>🔔 طلبات بانتظار المراجعة <span className="badge gold" style={{ fontSize: 16, padding: '4px 14px' }}>{pending.length}</span></h2>
        <button className="btn ghost small" type="button" onClick={load}>🔄 تحديث</button>
      </div>
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

      <h2>🛡️ الأدمنز ({admins.length})</h2>
      <p className="muted">الأدمن يرى لوحة التحكم وطلبات العضوية، ويستطيع إضافة أدمنز آخرين. الأدمن الرئيسي لا يمكن إزالته.</p>
      {admins.map((a) => (
        <div key={a.id} className="card">
          <div className="space">
            <div><strong>{a.name}</strong><p className="muted" style={{ margin: 0 }}>{a.email}{isAdminEmail(a.email) ? ' · الأدمن الرئيسي' : ''}</p></div>
            {!isAdminEmail(a.email) && a.email !== user.email && (
              <button className="btn danger small" type="button" onClick={() => removeAdmin(a.email)}>إزالة الأدمن</button>
            )}
          </div>
        </div>
      ))}
      <form onSubmit={addAdmin} className="card">
        <h3 style={{ marginTop: 0 }}>إضافة أدمن جديد</h3>
        <p className="muted">أدخل إيميل شخص مسجّل حسابًا في الموقع أولًا — إن لم يكن له حساب ستظهر رسالة خطأ.</p>
        <div className="row">
          <input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="email@example.com" dir="ltr" style={{ textAlign: 'left', flex: 1 }} required />
          <button className="btn" disabled={busy}>{busy ? 'جاري...' : '➕ إضافة أدمن'}</button>
        </div>
      </form>
    </main>
  );
}

export default function AdminPage() {
  return <AuthProvider><TopBar /><Suspense fallback={<main className="container"><p>جاري التحميل...</p></main>}><AdminInner /></Suspense></AuthProvider>;
}
