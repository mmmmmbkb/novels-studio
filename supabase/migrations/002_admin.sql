-- استوديو الروايات — Migration 002: قراءة الأدمن لملفات المستخدمين
-- شغّل هذا الملف في Supabase Dashboard → SQL Editor → New query
-- بعد تشغيل 001_init.sql.
--
-- الهدف: يسمح للأدمن (role='admin') بقراءة كل profiles من المتصفح
-- (لعرض قائمة الأدمنز والطلبات)، بينما تبقى الكتابة على الأدوار
-- محصورة في routes الخادم /api/admin/* عبر SUPABASE_SERVICE_ROLE_KEY.
-- لا يغيّر هذا الملف أي جدول أو trigger من 001_init.sql.

drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
