// ── استوديو الروايات — ناشر ميراكس (خلفية الإضافة، MV3) ─────────────
// مبدأ أساسي لا يُكسر: النشر يتم بحساب المستخدم الناشر نفسه فقط.
// الإضافة لا تملك أي توكن فيسبوك، ولا حسابًا مشتركًا، ولا تنشر بالنيابة
// عن محمود (الأدمن) أو عن أي شخص آخر. كل ما تفعله: تفتح صفحة كاتب
// البوست في الجروب داخل متصفح المستخدم، وهو مسجّل دخول بحسابه هو،
// وتملأ النص، ثم يضغط المستخدم نفسه زر «نشر» داخل فيسبوك.
// إذا لم يكن المستخدم مسجّل دخول فيسبوك في هذا المتصفح، لن يعمل النشر.

const GROUP_ID = '918194596679289';
const GROUP_URL = `https://www.facebook.com/groups/${GROUP_ID}/`;
// فاصل أمان: منشور واحد كل 60 ثانية على الأقل (حماية من التكرار السريع).
const MIN_INTERVAL_MS = 60_000;

async function getState() {
  const s = await chrome.storage.local.get(['pendingPublish', 'lastPublishAt', 'lastStatus']);
  return s;
}

async function setStatus(status, detail = '') {
  await chrome.storage.local.set({ lastStatus: { status, detail, at: Date.now() } });
  try { await chrome.runtime.sendMessage({ type: 'NOVELS_STATUS', status, detail }); } catch { /* لا مستمع مفتوح */ }
}

async function canPublishNow() {
  const { lastPublishAt } = await getState();
  if (!lastPublishAt) return { ok: true, waitSec: 0 };
  const elapsed = Date.now() - lastPublishAt;
  if (elapsed >= MIN_INTERVAL_MS) return { ok: true, waitSec: 0 };
  return { ok: false, waitSec: Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000) };
}

// استقبال طلب نشر من موقع الاستوديو (عبر content-webapp.js) أو من الـ popup.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'NOVELS_PUBLISH_REQUEST') {
    handlePublishRequest(msg.payload).then(sendResponse);
    return true; // رد غير متزامن
  }
  if (msg?.type === 'NOVELS_GET_STATE') {
    getState().then((s) => sendResponse({ ok: true, ...s }));
    return true;
  }
  if (msg?.type === 'NOVELS_CLEAR_PENDING') {
    chrome.storage.local.remove('pendingPublish').then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

// رسائل خارجية من موقع الاستوديو (عند معرفة ID الإضافة) — نفس المعالجة.
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'NOVELS_PUBLISH_REQUEST') {
    handlePublishRequest(msg.payload).then(sendResponse);
    return true;
  }
  return false;
});

async function handlePublishRequest(payload) {
  if (!payload || typeof payload.text !== 'string' || !payload.text.trim()) {
    return { ok: false, error: 'لا يوجد نص فصل للإرسال إلى الإضافة.' };
  }
  if (payload.text.length > 60000) {
    return { ok: false, error: 'نص الفصل طويل جدًا للنشر في منشور واحد.' };
  }
  const gate = await canPublishNow();
  if (!gate.ok) {
    const msg = `انتظر ${gate.waitSec} ثانية قبل النشر التالي — منشور واحد كل دقيقة على الأقل، حمايةً لحسابك من التقييد.`;
    await setStatus('rate_limited', msg);
    return { ok: false, error: msg, waitSec: gate.waitSec };
  }

  // حفظ الطلب كـ "معلّق" — النشر الفعلي لا يتم إلا بعد أن يضغط المستخدم
  // زر «نشر» بنفسه داخل فيسبوك، من حسابه هو.
  const pending = {
    text: payload.text,
    novelTitle: payload.novelTitle || '',
    chapterTitle: payload.chapterTitle || '',
    chapterId: payload.chapterId || '',
    novelId: payload.novelId || '',
    receivedAt: Date.now(),
  };
  await chrome.storage.local.set({ pendingPublish: pending });
  // سجّل وقت الطلب الآن (وليس عند التأكيد فقط) حتى يمنع الفاصل الزمني
  // طلب نشر ثانٍ فوريًا قبل أن يضغط المستخدم «نشر» أصلًا.
  await chrome.storage.local.set({ lastPublishAt: Date.now() });
  await setStatus('ready', 'المنشور جاهز. سيُفتح الجروب في تبويب جديد ويُملأ النص — اضغط «نشر» بنفسك داخل فيسبوك من حسابك.');

  // افتح تبويب كاتب البوست في الجروب (في جلسة المستخدم نفسه).
  const tab = await chrome.tabs.create({ url: GROUP_URL, active: true });
  // content-facebook.js في ذلك التبويب سيلتقط الطلب المعلّق ويملأ النص.
  return { ok: true, tabId: tab.id, message: 'تم فتح الجروب وسيُملأ النص. اضغط «نشر» بنفسك داخل فيسبوك من حسابك أنت.' };
}

// يُستدعى من content-facebook.js بعد أن يضغط المستخدم «نشر» ويظهر المنشور،
// أو بعد تأكيد النشر من الـ popup — يسجّل وقت آخر نشر (للفاصل الزمني).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'NOVELS_PUBLISHED_CONFIRMED') {
    chrome.storage.local.set({ lastPublishAt: Date.now() })
      .then(() => chrome.storage.local.remove('pendingPublish'))
      .then(() => setStatus('published', 'تم النشر من حسابك. سجّل تأكيد النشر في الاستوديو ليُحتسب +50 نقطة.'))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
