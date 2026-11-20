-- استوديو الروايات — مخطط Supabase (Postgres)
-- شغّل هذا الملف في Supabase Dashboard → SQL Editor → New query
-- ثم أنشئ Bucket باسم `covers` في Storage واجعله Public للقراءة.
-- الجداول محمية بـ Row Level Security: كل مستخدم يرى ويعدّل بياناته فقط،
-- والأدمن يرى طلبات التحقق من العضوية.

create extension if not exists "pgcrypto";

-- الملفات الشخصية (مرتبطة بـ auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'كاتب',
  facebook_id text,
  facebook_url text,
  facebook_name text,
  membership_status text not null default 'none'
    check (membership_status in ('none','pending','approved','rejected')),
  role text not null default 'member' check (role in ('admin','member')),
  points integer not null default 0,
  created_at timestamptz not null default now()
);

-- الروايات
create table if not exists public.novels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  author_name text not null,
  genre text not null default '',
  description text not null default '',
  cover_url text,
  cover_color text not null default '#7c3aed',
  status text not null default 'draft' check (status in ('draft','ongoing','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- الفصول
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  novel_id uuid not null references public.novels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null default '',
  order_index integer not null default 1,
  word_count integer not null default 0,
  published boolean not null default false,
  fb_post_url text,
  fb_post_id text,
  last_synced_reactions integer not null default 0,
  last_synced_comments integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- سجل النقاط
create table if not exists public.points_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  label text not null,
  chapter_id uuid references public.chapters(id) on delete set null,
  novel_id uuid references public.novels(id) on delete set null,
  created_at timestamptz not null default now()
);

-- طلبات التحقق من عضوية الجروب
create table if not exists public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  user_email text not null,
  facebook_url text not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- إنشاء الملف تلقائيًا عند التسجيل + منح دور الأدمن للإيميل المحدد
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  admin_email text := current_setting('app.admin_email', true);
begin
  insert into public.profiles (id, email, name, role, membership_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when lower(new.email) = lower(coalesce(admin_email, '')) then 'admin' else 'member' end,
    case when lower(new.email) = lower(coalesce(admin_email, '')) then 'approved' else 'none' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- فهارس
create index if not exists novels_user_idx on public.novels(user_id);
create index if not exists chapters_novel_idx on public.chapters(novel_id);
create index if not exists chapters_user_idx on public.chapters(user_id);
create index if not exists points_user_idx on public.points_events(user_id);
create index if not exists requests_status_idx on public.membership_requests(status);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.novels enable row level security;
alter table public.chapters enable row level security;
alter table public.points_events enable row level security;
alter table public.membership_requests enable row level security;

-- سياسات مبسطة: المالك فقط (الأدمن يرى طلبات العضوية عبر service role في السيرفر)
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own novels" on public.novels;
create policy "own novels" on public.novels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own chapters" on public.chapters;
create policy "own chapters" on public.chapters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own points" on public.points_events;
create policy "own points" on public.points_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own requests" on public.membership_requests;
create policy "own requests" on public.membership_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
