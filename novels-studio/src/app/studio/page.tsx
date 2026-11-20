'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import { getDB } from '@/lib/db';
import type { Chapter, Novel, PointsEvent } from '@/lib/types';
import { countWords, levelFor, POINTS } from '@/lib/points';
import { GROUP, isFacebookProfileUrl } from '@/lib/facebook';

const COLORS = ['#7c3aed', '#db2777', '#059669', '#d97706', '#2563eb', '#dc2626', '#0d9488'];

function Cover({ novel, size = 120 }: { novel: Novel; size?: number }) {
  if (novel.coverUrl) return <img src={novel.coverUrl} alt={novel.title} style={{ width: size, height: size * 4 / 3, objectFit: 'cover', borderRadius: 12 }} />;
  return <div className="cover-placeholder" style={{ width: size, height: size * 4 / 3, background: novel.coverColor, fontSize: size / 3 }}>{novel.title.slice(0, 1)}</div>;
}

function StudioInner() {
  const { user, loading, refresh } = useAuth();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selected, setSelected] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [draft, setDraft] = useState('');
  const [events, setEvents] = useState<PointsEvent[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // new novel form
  const [nt, setNt] = useState(''); const [ng, setNg] = useState(''); const [nd, setNd] = useState('');
  const [nc, setNc] = useState(COLORS[0]); const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  // membership form
  const [fbUrl, setFbUrl] = useState(''); const [fbNote, setFbNote] = useState('');
  // publish
  const [publishText, setPublishText] = useState(''); const [fbPostUrl, setFbPostUrl] = useState('');
  // إضافة كروم «ناشر ميراكس»: النشر يتم بحساب المستخدم الناشر نفسه فقط،
  // من جلسة فيسبوك المسجّل دخول فيها في متصفحه هو — بلا توكن مشترك
  // وبلا نشر بالنيابة عن الأدمن. الإضافة تملأ النص فقط، والمستخدم
  // يضغط «نشر» بنفسه داخل فيسبوك.
  const [extInstalled, setExtInstalled] = useState(false);
  const [extStatus, setExtStatus] = useState('');
  useEffect(() => {
    const onReady = () => setExtInstalled(true);
    const onStatus = (e: Event) => { const d = (e as CustomEvent).detail || {}; setExtStatus(d.message || d.status || ''); };
    window.addEventListener('novels-studio:extension-ready', onReady);
    window.addEventListener('novels-studio:extension-status', onStatus);
    if (document.documentElement.hasAttribute('data-novels-extension')) setExtInstalled(true);
    return () => { window.removeEventListener('novels-studio:extension-ready', onReady); window.removeEventListener('novels-studio:extension-status', onStatus); };
  }, []);
  // sync
  const [syncR, setSyncR] = useState(''); const [syncC, setSyncC] = useState('');

  async function load() {
    if (!user) return;
    const db = getDB();
    setNovels(await db.listNovels(user.id));
    setEvents(await db.listPointsEvents(user.id));
  }
  useEffect(() => { load(); }, [user]);

  async function loadChapters(novel: Novel) {
    setSelected(novel); setChapter(null); setDraft(''); setPublishText('');
    setChapters(await getDB().listChapters(novel.id));
  }

  async function createNovel(e: React.FormEvent) {
    e.preventDefault(); if (!user) return; setErr(''); setBusy(true);
    try {
      let coverUrl: string | null = null;
      if (coverFile) coverUrl = await getDB().uploadCover(coverFile);
      const novel = await getDB().createNovel(user.id, { title: nt.trim(), authorName: user.name, genre: ng.trim(), description: nd.trim(), coverUrl, coverColor: nc, status: 'ongoing' });
      setNt(''); setNg(''); setNd(''); setCoverFile(null); setCoverPreview('');
      await load(); await loadChapters(novel); setMsg('✅ تم إنشاء الرواية');
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); } finally { setBusy(false); }
  }

  function onCoverPick(f: File | undefined) {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setErr('صورة الغلاف يجب أن تكون JPG أو PNG أو WebP'); return; }
    if (f.size > 8 * 1024 * 1024) { setErr('صورة الغلاف أكبر من 8MB'); return; }
    setCoverFile(f); setCoverPreview(URL.createObjectURL(f));
  }

  async function addChapter() {
    if (!user || !selected) return; setBusy(true);
    try {
      const title = `الفصل ${chapters.length + 1}`;
      const ch = await getDB().createChapter(user.id, selected.id, title);
      setChapters(await getDB().listChapters(selected.id));
      setChapter(ch); setDraft(''); setMsg(`✅ فصل جديد (+${POINTS.CHAPTER_CREATED} نقاط)`);
      await load();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); } finally { setBusy(false); }
  }

  async function saveChapter() {
    if (!chapter) return; setBusy(true);
    try {
      const updated = await getDB().updateChapter(chapter.id, { content: draft });
      setChapter(updated); setChapters(await getDB().listChapters(updated.novelId));
      setMsg('✅ تم الحفظ'); await load();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); } finally { setBusy(false); }
  }

  async function preparePublish() {
    if (!chapter || !selected || !user) return; setBusy(true); setErr('');
    try {
      const res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ novelTitle: selected.title, chapterTitle: chapter.title, authorName: user.name, content: draft || chapter.content, novelId: selected.id, chapterId: chapter.id }) });
      const data = await res.json();
      setPublishText(data.preparedText || '');
      setMsg(data.note || '');
      return data.preparedText || '';
    } catch { setErr('تعذّر تجهيز المنشور'); return ''; } finally { setBusy(false); }
  }

  // النشر عبر إضافة كروم: يرسل النص المنسق إلى الإضافة، فتفتح تبويب الجروب
  // وتملأ النص — ثم يضغط المستخدم «نشر» بنفسه داخل فيسبوك من حسابه هو.
  async function publishViaExtension() {
    if (!chapter || !selected || !user) return;
    setErr(''); setExtStatus('جارٍ تجهيز النص وإرساله إلى الإضافة…');
    const text = publishText || (await preparePublish());
    if (!text) { setExtStatus(''); return; }
    window.dispatchEvent(new CustomEvent('novels-studio:publish-request', { detail: { text, novelTitle: selected.title, chapterTitle: chapter.title, authorName: user.name, chapterId: chapter.id, novelId: selected.id } }));
    // إذا لم ترد الإضافة (غير مثبتة)، أظهر تعليمات التثبيت بعد مهلة قصيرة.
    setTimeout(() => {
      if (!document.documentElement.hasAttribute('data-novels-extension')) {
        setExtInstalled(false);
        setExtStatus('الإضافة غير مثبتة في هذا المتصفح. ثبّتها من مجلد extension/ في المشروع: chrome://extensions ← وضع المطوّر ← Load unpacked ← مجلد extension/ — ثم أعد تحميل هذه الصفحة. ملاحظة: الإضافة للكمبيوتر فقط ولا تعمل على أندرويد.');
      }
    }, 1500);
  }

  async function confirmPublished() {
    if (!chapter) return; setBusy(true);
    try {
      const updated = await getDB().publishChapter(chapter.id, fbPostUrl || undefined);
      setChapter(updated); setChapters(await getDB().listChapters(updated.novelId));
      setMsg(`✅ تم تسجيل النشر (+${POINTS.PUBLISH} نقاط). تذكير: النشر الفعلي في الجروب يتم يدويًا من حسابك على فيسبوك.`);
      await load();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); } finally { setBusy(false); }
  }

  async function syncEngagement() {
    if (!chapter) return; setBusy(true);
    try {
      const { gained } = await getDB().syncEngagement(chapter.id, parseInt(syncR || '0', 10), parseInt(syncC || '0', 10));
      const updated = (await getDB().listChapters(chapter.novelId)).find((c) => c.id === chapter.id);
      if (updated) setChapter(updated);
      setMsg(gained > 0 ? `✅ مزامنة ناجحة: +${gained} نقطة جديدة` : '✅ تمت المزامنة — لا تفاعلات جديدة');
      await load();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); } finally { setBusy(false); }
  }

  function exportPdf() {
    if (!selected) return;
    const w = window.open('', '_blank'); if (!w) { setErr('اسمح بالنوافذ المنبثقة لتصدير PDF'); return; }
    const body = chapters.map((c) => `<h2>${c.title}</h2><p>${c.content.replace(/\n/g, '<br/>')}</p>`).join('<hr/>');
    w.document.write(`<html dir="rtl" lang="ar"><head><title>${selected.title}</title><style>body{font-family:Georgia,serif;line-height:2;padding:40px}h1{text-align:center}img{max-width:220px}</style></head><body><h1>${selected.title}</h1><p style="text-align:center">بقلم: ${selected.authorName} — استوديو الروايات / ميراكس</p>${selected.coverUrl ? `<div style="text-align:center"><img src="${selected.coverUrl}"/></div>` : ''}<p>${selected.description}</p>${body}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  }

  async function submitMembership(e: React.FormEvent) {
    e.preventDefault(); if (!user) return; setErr('');
    if (!isFacebookProfileUrl(fbUrl)) { setErr('أدخل رابط بروفايل فيسبوك صحيحًا (facebook.com/...)'); return; }
    setBusy(true);
    try { await getDB().requestMembership(user, fbUrl.trim(), fbNote.trim()); await refresh(); setMsg('✅ أُرسل طلب التحقق للأدمن. ستظهر النتيجة هنا بعد المراجعة.'); }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : 'خطأ'); } finally { setBusy(false); }
  }

  if (loading) return <main className="container"><p>جاري التحميل...</p></main>;
  if (!user) return <main className="container"><div className="card"><h1>سجّل دخول أولًا</h1><p>الاستوديو للأعضاء فقط. أنشئ حسابًا أو سجّل دخولك.</p><Link href="/auth"><button className="btn">تسجيل الدخول / إنشاء حساب</button></Link></div></main>;

  const lvl = levelFor(user.points);
  const gated = user.role !== 'admin' && user.membershipStatus !== 'approved';

  return (
    <main className="container">
      {msg && <div className="alert green">{msg}</div>}
      {err && <div className="alert red">{err}</div>}

      <div className="card space">
        <div><h2>أهلًا، {user.name} 👋</h2><p className="muted">{user.email} · {user.role === 'admin' ? '🛡️ أدمن' : 'عضو'}</p></div>
        <div style={{ minWidth: 240 }}>
          <div className="row"><span className="badge gold">⭐ {user.points} نقطة</span><span className="badge">المستوى {lvl.current.level} — {lvl.current.title}</span></div>
          <div className="progress" style={{ marginTop: 8 }}><div style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          <p className="muted">{lvl.next ? `${lvl.next.min - user.points} نقطة للمستوى ${lvl.next.level}` : 'وصلت لأعلى مستوى 🏆'}</p>
        </div>
      </div>

      {gated && (
        <div className="card">
          <h2>🔐 التحقق من عضوية جروب ميراكس</h2>
          {user.membershipStatus === 'pending' ? (
            <div className="alert">⏳ طلبك قيد مراجعة الأدمن. سيتم فتح الاستوديو فور الموافقة. رابط بروفايلك: {user.facebookUrl}</div>
          ) : user.membershipStatus === 'rejected' ? (
            <div className="alert red">❌ رُفض طلب التحقق السابق. تأكد أنك عضو فعلًا في الجروب ثم أعد إرسال الطلب برابط بروفايل صحيح.</div>
          ) : null}
          <div className="alert">
            <strong>لماذا التحقق يدوي؟</strong> ألغت Meta واجهة Groups API في 22 أبريل 2024، فلا يمكن لأي تطبيق التحقق تلقائيًا من عضوية الجروب. الأدمن (محمود) يراجع رابط بروفايلك ويتأكد من عضويتك في الجروب ثم يوافق من لوحة التحكم.
          </div>
          <form onSubmit={submitMembership}>
            <div className="field"><label>رابط بروفايل فيسبوك الخاص بك</label><input value={fbUrl} onChange={(e) => setFbUrl(e.target.value)} required dir="ltr" style={{ textAlign: 'left' }} placeholder="https://www.facebook.com/your.profile" /></div>
            <div className="field"><label>ملاحظة للأدمن (اختياري)</label><input value={fbNote} onChange={(e) => setFbNote(e.target.value)} placeholder="مثال: أنا عضو في الجروب منذ 2024" /></div>
            <button className="btn gold" disabled={busy}>إرسال طلب التحقق</button>
          </form>
        </div>
      )}

      {!gated && (
        <>
          <div className="card">
            <h2>➕ رواية جديدة</h2>
            <form onSubmit={createNovel}>
              <div className="field"><label>عنوان الرواية</label><input value={nt} onChange={(e) => setNt(e.target.value)} required placeholder="مثال: ظلال المدينة" /></div>
              <div className="field"><label>النوع</label><input value={ng} onChange={(e) => setNg(e.target.value)} placeholder="فانتازيا، رومانسية، غموض..." /></div>
              <div className="field"><label>الوصف</label><textarea value={nd} onChange={(e) => setNd(e.target.value)} placeholder="نبذة قصيرة عن الرواية..." /></div>
              <div className="field"><label>صورة الغلاف من جهازك (JPG/PNG/WebP حتى 8MB) — اختياري</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onCoverPick(e.target.files?.[0])} /></div>
              {coverPreview && <img src={coverPreview} alt="معاينة الغلاف" style={{ width: 120, borderRadius: 12, marginBottom: 10 }} />}
              <div className="field"><label>لون الغلاف (إذا لم ترفع صورة)</label><div className="row">{COLORS.map((c) => <button key={c} type="button" onClick={() => setNc(c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: nc === c ? '3px solid #fff' : '1px solid #888' }} aria-label={c} />)}</div></div>
              <button className="btn" disabled={busy}>إنشاء الرواية</button>
            </form>
          </div>

          <h2>📚 مكتبة رواياتك ({novels.length})</h2>
          <div className="grid">
            {novels.map((n) => (
              <div key={n.id} className="card" style={{ cursor: 'pointer' }} onClick={() => loadChapters(n)}>
                <Cover novel={n} />
                <h3 style={{ marginTop: 10 }}>{n.title}</h3>
                <p className="muted">{n.genre} · {n.status === 'ongoing' ? 'مستمرة' : n.status === 'completed' ? 'مكتملة' : 'مسودة'}</p>
              </div>
            ))}
            {novels.length === 0 && <p className="muted">لا روايات بعد — أنشئ أول رواية لك من الأعلى.</p>}
          </div>

          {selected && (
            <div className="card">
              <div className="space"><h2>📖 {selected.title}</h2><div className="row"><button className="btn gold small" onClick={exportPdf}>🖨️ تصدير PDF</button><button className="btn ghost small" onClick={addChapter} disabled={busy}>+ فصل جديد (+{POINTS.CHAPTER_CREATED})</button></div></div>
              <p>{selected.description}</p>
              <div className="row" style={{ marginBottom: 12 }}>
                {chapters.map((c) => <button key={c.id} className="btn ghost small" onClick={() => { setChapter(c); setDraft(c.content); setPublishText(''); }} style={chapter?.id === c.id ? { borderColor: '#e8b64c' } : {}}>{c.title}{c.published ? ' ✅' : ''}</button>)}
              </div>

              {chapter && (
                <div>
                  <div className="field"><label>{chapter.title} — {countWords(draft)} كلمة · +{Math.floor(countWords(draft) / 500) * POINTS.WORDS_PER_500} نقاط كلمات</label>
                    <textarea className="editor" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب الفصل هنا..." />
                  </div>
                  <div className="row no-print">
                    <button className="btn" onClick={saveChapter} disabled={busy}>💾 حفظ الفصل</button>
                    <button className="btn gold" onClick={preparePublish} disabled={busy}>📣 تجهيز النشر في الجروب</button>
                    <button className="btn" onClick={publishViaExtension} disabled={busy} title="النشر يتم بحسابك أنت، من جلسة فيسبوك في متصفحك — بلا توكن مشترك وبلا نشر بالنيابة عن الأدمن">🚀 انشر عبر الإضافة (بحسابك أنت)</button>
                  </div>
                  {extStatus && <p className="muted" style={{ marginTop: 8 }}>🧩 الإضافة: {extStatus}</p>}
                  {!extInstalled && (
                    <div className="alert" style={{ marginTop: 8 }}>
                      <strong>إضافة كروم «ناشر ميراكس» غير مثبتة هنا.</strong> للنشر بضغطة واحدة من حسابك: ثبّت الإضافة من مجلد <code>extension/</code> في المشروع — <code>chrome://extensions</code> ← وضع المطوّر ← Load unpacked ← مجلد <code>extension/</code> — ثم أعد تحميل الصفحة. الإضافة للكمبيوتر فقط ولا تعمل على كروم أندرويد. <strong>على أندرويد:</strong> استخدم Firefox + سكربت Tampermonkey من مجلد <code>extension/android/</code> (الطريقة الموصى بها)، أو نسخة Firefox من مجلد <code>extension/firefox/</code> — التفاصيل في <code>extension/android/README.md</code>. بدونها يمكنك النشر يدويًا بالنسخ من الأسفل.
                    </div>
                  )}

                  {publishText && (
                    <div className="card" style={{ marginTop: 14, background: '#251a44' }}>
                      <h3>📣 منشور جاهز للنشر في ميراكس</h3>
                      <p>⚠️ النشر الآلي عبر API غير متاح (ألغته Meta في 2024). للنشر بضغطة واحدة استخدم زر «🚀 انشر عبر الإضافة (بحسابك أنت)» أعلاه — الإضافة تفتح الجروب وتملأ النص، وتضغط «نشر» بنفسك داخل فيسبوك <strong>من حسابك أنت</strong>، وليس بحساب الأدمن. أو انسخ النص يدويًا والصقه كمنشور جديد من حسابك، ثم الصق رابط المنشور هنا واضغط «تأكيد النشر» لتسجيل +{POINTS.PUBLISH} نقطة.</p>
                      <textarea value={publishText} readOnly rows={8} style={{ width: '100%', background: '#120b26', color: '#f3efff', borderRadius: 10, padding: 12 }} />
                      <div className="row" style={{ marginTop: 10 }}>
                        <button className="btn small" onClick={() => navigator.clipboard.writeText(publishText)}>📋 نسخ النص</button>
                        <a href={GROUP.url} target="_blank" rel="noreferrer"><button className="btn gold small" type="button">فتح جروب ميراكس ↗</button></a>
                      </div>
                      <div className="field" style={{ marginTop: 12 }}><label>رابط منشور فيسبوك بعد النشر (اختياري)</label><input value={fbPostUrl} onChange={(e) => setFbPostUrl(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} placeholder="https://www.facebook.com/groups/918194596679289/permalink/..." /></div>
                      <button className="btn" onClick={confirmPublished} disabled={busy}>✅ تأكيد النشر (+{POINTS.PUBLISH} نقطة)</button>
                    </div>
                  )}

                  {chapter.published && (
                    <div className="card" style={{ marginTop: 14 }}>
                      <h3>🔄 مزامنة التفاعلات (يدوية — لأن Groups API أُلغي)</h3>
                      <p className="muted">افتح منشور الفصل في الجروب، واكتب عدد التفاعلات والتعليقات الحالي. تُحتسب فقط الزيادة عن آخر مزامنة: +{POINTS.REACTION} لكل تفاعل جديد، +{POINTS.COMMENT} لكل تعليق جديد.</p>
                      <div className="row">
                        <input type="number" min={0} value={syncR} onChange={(e) => setSyncR(e.target.value)} placeholder="التفاعلات" style={{ width: 130, padding: 10, borderRadius: 10, background: '#120b26', color: '#fff', border: '1px solid #444' }} />
                        <input type="number" min={0} value={syncC} onChange={(e) => setSyncC(e.target.value)} placeholder="التعليقات" style={{ width: 130, padding: 10, borderRadius: 10, background: '#120b26', color: '#fff', border: '1px solid #444' }} />
                        <button className="btn small" onClick={syncEngagement} disabled={busy}>مزامنة</button>
                      </div>
                      <p className="muted">آخر مزامنة: {chapter.lastSyncedReactions || 0} تفاعل · {chapter.lastSyncedComments || 0} تعليق {chapter.fbPostUrl && <>· <a href={chapter.fbPostUrl} target="_blank" rel="noreferrer">فتح المنشور ↗</a></>}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h2>⭐ سجل نقاطك</h2>
            {events.length === 0 ? <p className="muted">لا نقاط بعد — اكتب فصلًا جديدًا أو انشر فصلًا.</p> : (
              <table><thead><tr><th>النقاط</th><th>السبب</th><th>التاريخ</th></tr></thead><tbody>
                {events.slice(0, 30).map((e) => <tr key={e.id}><td>+{e.amount}</td><td>{e.label}</td><td className="muted">{new Date(e.createdAt).toLocaleString('ar-EG')}</td></tr>)}
              </tbody></table>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default function StudioPage() {
  return <AuthProvider><TopBar /><StudioInner /></AuthProvider>;
}
