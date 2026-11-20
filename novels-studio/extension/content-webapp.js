// ── content script: موقع استوديو الروايات ────────────────────────────
// يربط صفحة الاستوديو بالإضافة. يعمل فقط على نطاق الموقع نفسه.
// يستمع لحدث CustomEvent باسم «novels-studio:publish-request» ترسله صفحة
// الاستوديو (زر «انشر عبر الإضافة»)، ويحوّله إلى background.js،
// ويعيد حالة الإضافة إلى الصفحة عبر حدث «novels-studio:extension-status».
// لا يقرأ أي بيانات من فيسبوك، ولا يملك أي توكن.

// إعلان وجود الإضافة للصفحة فور التحميل.
window.dispatchEvent(new CustomEvent('novels-studio:extension-ready', { detail: { installed: true } }));
document.documentElement.setAttribute('data-novels-extension', 'installed');

window.addEventListener('novels-studio:publish-request', async (event) => {
  const payload = event.detail || {};
  const reply = (detail) => window.dispatchEvent(new CustomEvent('novels-studio:extension-status', { detail }));
  try {
    const res = await chrome.runtime.sendMessage({ type: 'NOVELS_PUBLISH_REQUEST', payload });
    if (res?.ok) {
      reply({ status: 'ready', message: res.message || 'تم فتح الجروب وسيُملأ النص — اضغط «نشر» بنفسك داخل فيسبوك من حسابك أنت.' });
    } else {
      reply({ status: 'failed', message: res?.error || 'تعذّر إرسال طلب النشر إلى الإضافة.' });
    }
  } catch (e) {
    reply({ status: 'failed', message: 'تعذّر التواصل مع الإضافة: ' + (e?.message || 'خطأ غير معروف') });
  }
});

// تحديثات حالة قادمة من background.js (جاهز / تم النشر / فشل).
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'NOVELS_STATUS') {
    window.dispatchEvent(new CustomEvent('novels-studio:extension-status', { detail: { status: msg.status, message: msg.detail || '' } }));
  }
});
