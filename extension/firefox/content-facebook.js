// ── content script: صفحة الجروب على فيسبوك ────────────────────────────
// يعمل فقط على facebook.com/groups/918194596679289.
// مهمته الوحيدة: ملء نص المنشور في كاتب البوست (composer) بحساب المستخدم
// المسجّل دخول في هذا المتصفح. لا ينقر زر «نشر» تلقائيًا أبدًا —
// المستخدم هو من يضغط «نشر» بنفسه داخل فيسبوك، من حسابه هو.
// لا يقرأ كلمة مرور ولا توكن ولا كوكيز، ولا يرسل أي بيانات لأي سيرفر.

const GROUP_ID = '918194596679289';

function findComposer() {
  // كاتب البوست في فيسبوك: عنصر contenteditable بدور textbox.
  // نجرّب عدة محددات لأن فيسبوك يغيّر واجهته باستمرار.
  const selectors = [
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label*="اكتب"]',
    'div[contenteditable="true"][aria-label*="Write"]',
    'div[contenteditable="true"][data-testid*="composer"]',
    'textarea[name="xhpc_message"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

function fillComposer(el, text) {
  el.focus();
  // إدراج النص بالطريقة التي يفهمها محرر React في فيسبوك.
  const ok = document.execCommand('insertText', false, text);
  if (!ok) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  }
  // تنبيه بصري صغير للمستخدم أن النص جاهز وأن النشر بحسابه هو.
  el.style.outline = '3px solid #e8b64c';
  el.style.outlineOffset = '2px';
}

function showBanner(kind, text) {
  const old = document.getElementById('novels-studio-banner');
  if (old) old.remove();
  const bar = document.createElement('div');
  bar.id = 'novels-studio-banner';
  bar.dir = 'rtl';
  bar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:999999;background:#1e1445;color:#fff;border:2px solid #e8b64c;border-radius:12px;padding:12px 18px;font:16px/1.7 system-ui,sans-serif;max-width:92vw;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.5)';
  bar.textContent = text;
  const close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = 'margin-inline-start:12px;background:none;border:none;color:#e8b64c;font-size:18px;cursor:pointer';
  close.onclick = () => bar.remove();
  bar.appendChild(close);
  document.body.appendChild(bar);
  if (kind === 'ok') setTimeout(() => bar.remove(), 15000);
}

async function tryFill() {
  const { pendingPublish } = await chrome.storage.local.get('pendingPublish');
  if (!pendingPublish?.text) return; // لا طلب معلّق — لا تفعل شيئًا.

  // هل المستخدم مسجّل دخول؟ غياب كاتب البوست غالبًا يعني عدم تسجيل الدخول
  // أو أن الجروب لم يفتح على صفحة الكتابة.
  const composer = findComposer();
  if (!composer) {
    showBanner('warn', 'استوديو الروايات: لم أجد مكان كتابة المنشور. تأكد أنك مسجّل دخول فيسبوك بحسابك أنت، وأنك داخل جروب ميراكس، ثم أعد تحميل الصفحة.');
    return;
  }
  if (composer.textContent.trim().length > 0) {
    showBanner('warn', 'استوديو الروايات: مكان الكتابة فيه نص بالفعل — لم أستبدله. امسح النص الحالي ثم أعد تحميل الصفحة ليُملأ نص الفصل.');
    return;
  }
  fillComposer(composer, pendingPublish.text);
  showBanner('ok', '✅ استوديو الروايات: تم ملء نص الفصل. راجعه جيدًا، ثم اضغط «نشر» بنفسك داخل فيسبوك — النشر سيتم بحسابك أنت، وليس بحساب الأدمن.');
  try { await chrome.runtime.sendMessage({ type: 'NOVELS_STATUS', status: 'filled', detail: 'تم ملء النص في كاتب البوست — بانتظار ضغط المستخدم على نشر.' }); } catch { /* لا مستمع */ }
}

// فيسبوك تطبيق صفحة واحدة: أعد المحاولة عدة مرات حتى يظهر الكاتب.
let attempts = 0;
const timer = setInterval(() => {
  attempts += 1;
  tryFill();
  if (attempts >= 20) clearInterval(timer); // ~40 ثانية كحد أقصى
}, 2000);

// مراقبة ظهور كاتب البوست عند النقر على «اكتب شيئًا...» داخل الجروب.
const observer = new MutationObserver(() => { tryFill(); });
observer.observe(document.documentElement, { childList: true, subtree: true });
