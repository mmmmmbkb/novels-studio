// ── popup الإضافة ─────────────────────────────────────────────────────
// يعرض آخر فصل مرسل من الموقع، وحالة النشر. النشر نفسه لا يتم هنا:
// الـ popup يفتح تبويب الجروب ويملأ النص، والمستخدم يضغط «نشر» بنفسه
// داخل فيسبوك، من حسابه هو. لا توكن، لا حساب مشترك، لا نشر بالنيابة.

const GROUP_URL = 'https://www.facebook.com/groups/918194596679289/';
const statusEl = document.getElementById('status');
const pendingEl = document.getElementById('pending');
const publishBtn = document.getElementById('publishBtn');
const confirmBtn = document.getElementById('confirmBtn');
const openGroupBtn = document.getElementById('openGroupBtn');

function setStatus(kind, text) {
  statusEl.className = 'status ' + kind;
  statusEl.textContent = text;
}

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: 'NOVELS_GET_STATE' }).catch(() => null);
  const pending = res?.pendingPublish;
  const last = res?.lastPublishAt;
  if (pending?.text) {
    pendingEl.textContent = `${pending.novelTitle || 'رواية'} — ${pending.chapterTitle || 'فصل'} (${pending.text.length} حرف). جاهز للملء في الجروب.`;
    publishBtn.disabled = false;
  } else {
    pendingEl.textContent = 'لا يوجد فصل مرسل من الموقع بعد. افتح فصلًا في الاستوديو واضغط «انشر عبر الإضافة».';
    publishBtn.disabled = true;
  }
  const lastStatus = res?.lastStatus;
  if (lastStatus?.status === 'published') setStatus('published', '✅ تم النشر من حسابك.');
  else if (lastStatus?.status === 'rate_limited') setStatus('failed', lastStatus.detail || 'انتظر قبل النشر التالي.');
  else if (pending?.text) setStatus('ready', '🟢 جاهز للنشر — سيتم بحسابك أنت.');
  else setStatus('', 'بانتظار فصل من الاستوديو…');
  if (last) {
    const wait = Math.ceil((60000 - (Date.now() - last)) / 1000);
    if (wait > 0) { publishBtn.disabled = true; publishBtn.textContent = `⏳ انتظر ${wait} ثانية قبل النشر التالي`; }
    else publishBtn.textContent = '🚀 افتح الجروب واملأ النص';
  }
}

publishBtn.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'NOVELS_GET_STATE' }).catch(() => null);
  const pending = res?.pendingPublish;
  if (!pending?.text) { setStatus('failed', 'لا يوجد فصل جاهز للنشر. أرسله أولًا من الاستوديو.'); return; }
  setStatus('publishing', '⏳ جارٍ فتح الجروب وملء النص…');
  const out = await chrome.runtime.sendMessage({ type: 'NOVELS_PUBLISH_REQUEST', payload: pending }).catch((e) => ({ ok: false, error: e?.message }));
  if (out?.ok) setStatus('ready', '✅ تم فتح الجروب وملء النص. راجع النص واضغط «نشر» بنفسك داخل فيسبوك — بحسابك أنت.');
  else setStatus('failed', '❌ ' + (out?.error || 'تعذّر فتح الجروب.'));
  await refresh();
});

confirmBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'NOVELS_PUBLISHED_CONFIRMED' }).catch(() => null);
  setStatus('published', '✅ تم تسجيل النشر. ارجع للاستوديو واضغط «تأكيد النشر» ليُحتسب +50 نقطة.');
  await refresh();
});

openGroupBtn.addEventListener('click', () => chrome.tabs.create({ url: GROUP_URL, active: true }));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'NOVELS_STATUS') refresh();
});

refresh();
setInterval(refresh, 2000);
