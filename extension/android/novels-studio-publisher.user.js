// ==UserScript==
// @name         استوديو الروايات — ناشر ميراكس (أندرويد)
// @namespace    https://novels-studio.local/
// @version      1.0.0
// @description  نشر فصول استوديو الروايات في جروب MIRAX NOVELS من حساب فيسبوك الخاص بك أنت، من جلسة متصفحك المسجّل دخول فيها — بدون توكن مشترك وبدون نشر بالنيابة عن الأدمن. يعمل على أندرويد عبر Tampermonkey في Firefox.
// @author       استوديو الروايات
// @match        https://www.facebook.com/groups/918194596679289
// @match        https://www.facebook.com/groups/918194596679289/*
// @match        https://web.facebook.com/groups/918194596679289
// @match        https://web.facebook.com/groups/918194596679289/*
// @match        http://localhost:3000/*
// @match        http://localhost:3100/*
// @match        https://*.vercel.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==
//
// ── المبدأ الأساسي: «النشر يتم بحسابك أنت» ──────────────────────────
// النشر باسم وحساب المستخدم الناشر نفسه فقط، وليس باسم/حساب محمود
// (الأدمن). هذا السكربت لا يملك أي توكن فيسبوك، ولا حسابًا مشتركًا،
// ولا ينشر بالنيابة عن أحد. يملأ نص الفصل في كاتب البوست في متصفحك
// أنت، وأنت مسجّل دخول فيسبوك بحسابك أنت، وأنت من يضغط «نشر» بنفسك
// داخل فيسبوك. السكربت لا ينقر زر «نشر» تلقائيًا أبدًا.
// ── تحذير ───────────────────────────────────────────────────────────
// أتمتة عبر جلسة المتصفح (ليست API رسميًا — ألغت Meta Groups API في
// 22 أبريل 2024). قد تخالف شروط فيسبوك أو تتوقف إذا غيّر فيسبوك واجهته،
// وقد تؤدي لتقييد الحساب عند الإفراط. منشور واحد كل 60 ثانية على
// الأقل، واستخدمها باعتدال وعلى مسؤوليتك.

(function () {
  'use strict';

  var GROUP_ID = '918194596679289';
  var GROUP_URL = 'https://www.facebook.com/groups/' + GROUP_ID + '/';
  var MIN_INTERVAL_MS = 60000;
  var PENDING_KEY = 'novelsPendingPublish';
  var LAST_KEY = 'novelsLastPublishAt';

  function getVal(key, def) {
    try {
      if (typeof GM_getValue === 'function') {
        var v = GM_getValue(key, def);
        return (v === undefined || v === null) ? def : v;
      }
    } catch (e) { /* تجاهل */ }
    try { var raw = localStorage.getItem(key); return raw === null ? def : JSON.parse(raw); } catch (e) { return def; }
  }
  function setVal(key, value) {
    try { if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; } } catch (e) { /* تجاهل */ }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* تجاهل */ }
  }
  function readPending() {
    var raw = getVal(PENDING_KEY, null);
    if (!raw) return null;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
  }

  function emitStatus(status, message) {
    try {
      document.documentElement.setAttribute('data-novels-extension', 'installed');
      window.dispatchEvent(new CustomEvent('novels-studio:extension-status', { detail: { status: status, message: message, via: 'tampermonkey' } }));
    } catch (e) { /* تجاهل */ }
  }
  function announceReady() {
    try {
      document.documentElement.setAttribute('data-novels-extension', 'installed');
      window.dispatchEvent(new CustomEvent('novels-studio:extension-ready', { detail: { installed: true, via: 'tampermonkey' } }));
    } catch (e) { /* تجاهل */ }
  }

  var isFacebook = /(^|\.)facebook\.com$/.test(window.location.hostname || '');

  // ── جانب فيسبوك: ملء كاتب البوست ───────────────────────────────────
  function findComposer() {
    var selectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][aria-label*="اكتب"]',
      'div[contenteditable="true"][aria-label*="Write"]',
      'div[contenteditable="true"][data-testid*="composer"]',
      'textarea[name="xhpc_message"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }
  function showBanner(text, ok) {
    var old = document.getElementById('novels-studio-banner');
    if (old) old.remove();
    var bar = document.createElement('div');
    bar.id = 'novels-studio-banner';
    bar.dir = 'rtl';
    bar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:999999;background:#1e1445;color:#fff;border:2px solid #e8b64c;border-radius:12px;padding:12px 18px;font:16px/1.7 system-ui,sans-serif;max-width:92vw;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    bar.textContent = text;
    var close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'margin-inline-start:12px;background:none;border:none;color:#e8b64c;font-size:18px;cursor:pointer';
    close.onclick = function () { bar.remove(); };
    bar.appendChild(close);
    document.body.appendChild(bar);
    if (ok) setTimeout(function () { bar.remove(); }, 15000);
  }
  function tryFill() {
    var pending = readPending();
    if (!pending || !pending.text) return false;
    var composer = findComposer();
    if (!composer) {
      showBanner('استوديو الروايات: لم أجد مكان كتابة المنشور. تأكد أنك مسجّل دخول فيسبوك بحسابك أنت، وأنك داخل جروب ميراكس، ثم أعد تحميل الصفحة.', false);
      return false;
    }
    if ((composer.textContent || '').trim().length > 0) {
      showBanner('استوديو الروايات: مكان الكتابة فيه نص بالفعل — لم أستبدله. امسح النص الحالي ثم أعد تحميل الصفحة ليُملأ نص الفصل.', false);
      return false;
    }
    composer.focus();
    var done = false;
    try { done = document.execCommand('insertText', false, pending.text); } catch (e) { done = false; }
    if (!done) {
      composer.textContent = pending.text;
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    } else {
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    }
    composer.style.outline = '3px solid #e8b64c';
    composer.style.outlineOffset = '2px';
    showBanner('✅ استوديو الروايات: تم ملء نص الفصل. راجعه جيدًا، ثم اضغط «نشر» بنفسك داخل فيسبوك — النشر سيتم بحسابك أنت، وليس بحساب الأدمن.', true);
    emitStatus('filled', 'تم ملء النص في كاتب البوست — بانتظار ضغط المستخدم على نشر.');
    return true;
  }
  function confirmPublished() {
    setVal(LAST_KEY, Date.now());
    setVal(PENDING_KEY, null);
    emitStatus('published', 'تم النشر من حسابك. سجّل تأكيد النشر في الاستوديو ليُحتسب +50 نقطة.');
  }

  // ── جانب الاستوديو: استقبال طلب النشر من الموقع ────────────────────
  function handlePublishRequest(payload) {
    if (!payload || typeof payload.text !== 'string' || !payload.text.trim()) {
      emitStatus('failed', 'لا يوجد نص فصل للإرسال.');
      return { ok: false, error: 'لا يوجد نص فصل للإرسال.' };
    }
    if (payload.text.length > 60000) {
      emitStatus('failed', 'نص الفصل طويل جدًا للنشر في منشور واحد.');
      return { ok: false, error: 'نص الفصل طويل جدًا.' };
    }
    var last = getVal(LAST_KEY, 0) || 0;
    var elapsed = Date.now() - last;
    if (elapsed < MIN_INTERVAL_MS) {
      var waitSec = Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000);
      var msg = 'انتظر ' + waitSec + ' ثانية قبل النشر التالي — منشور واحد كل دقيقة على الأقل، حمايةً لحسابك من التقييد.';
      emitStatus('rate_limited', msg);
      return { ok: false, error: msg, waitSec: waitSec };
    }
    var pending = {
      text: payload.text,
      novelTitle: payload.novelTitle || '',
      chapterTitle: payload.chapterTitle || '',
      chapterId: payload.chapterId || '',
      novelId: payload.novelId || '',
      receivedAt: Date.now()
    };
    setVal(PENDING_KEY, JSON.stringify(pending));
    // سجّل وقت الطلب الآن (وليس عند التأكيد فقط) حتى يمنع الفاصل الزمني
    // طلب نشر ثانٍ فوريًا قبل أن يضغط المستخدم «نشر» أصلًا.
    setVal(LAST_KEY, Date.now());
    emitStatus('ready', 'المنشور جاهز. سيُفتح الجروب في تبويب جديد ويُملأ النص — اضغط «نشر» بنفسك داخل فيسبوك من حسابك.');
    var opened = null;
    try { opened = window.open(GROUP_URL, '_blank'); } catch (e) { opened = null; }
    if (!opened) {
      emitStatus('ready', 'تم حفظ المنشور. افتح الجروب يدويًا من هذا الرابط وسيُملأ النص: ' + GROUP_URL);
      return { ok: true, opened: false, message: 'تم حفظ المنشور — افتح الجروب يدويًا.' };
    }
    return { ok: true, opened: true, message: 'تم فتح الجروب وسيُملأ النص. اضغط «نشر» بنفسك داخل فيسبوك من حسابك أنت.' };
  }

  // ── التشغيل ─────────────────────────────────────────────────────────
  announceReady();

  if (isFacebook) {
    // أعد المحاولة حتى يظهر كاتب البوست (فيسبوك تطبيق صفحة واحدة).
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (tryFill()) clearInterval(timer);
      if (attempts >= 20) clearInterval(timer);
    }, 2000);
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () { tryFill(); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    if (typeof GM_addValueChangeListener === 'function') {
      try { GM_addValueChangeListener(PENDING_KEY, function () { tryFill(); }); } catch (e) { /* تجاهل */ }
    }
    if (typeof GM_registerMenuCommand === 'function') {
      try { GM_registerMenuCommand('✅ تأكيد أنني نشرت (استوديو الروايات)', confirmPublished); } catch (e) { /* تجاهل */ }
    }
    // إتاحة التأكيد للاختبار وللاستدعاء من الصفحة.
    window.__novelsStudioConfirmPublished = confirmPublished;
    window.__novelsStudioTryFill = tryFill;
  } else {
    window.addEventListener('novels-studio:publish-request', function (event) {
      handlePublishRequest((event && event.detail) || {});
    });
    window.__novelsStudioPublish = handlePublishRequest;
    window.__novelsStudioConfirmPublished = confirmPublished;
  }
})();
