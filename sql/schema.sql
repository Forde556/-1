-- ============================================================
-- "طبيّة | The Easiest in Dentistry" — Supabase schema
-- Free-tier friendly, built for ~150-300 students.
-- Run this once in Supabase SQL editor (Project → SQL Editor).
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. PROFILES (extends auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique not null,
  avatar_url text,
  academic_year int default 1 check (academic_year between 1 and 5),
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'طالب جديد'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. SUBJECTS & LECTURES (grid content, Image 2 style)
-- ------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  icon text,               -- emoji or icon key
  color text default '#14304A',
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists public.lectures (
  id uuid primary key default uuid_generate_v4(),
  subject_id uuid references public.subjects(id) on delete cascade,
  title text not null,
  description text,
  file_url text,            -- PDF / slide link (Supabase Storage)
  video_url text,           -- streaming or external video link
  lecture_number int,
  duration_minutes int,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. STREAKS & ENGAGEMENT TRACKING (Image 1: التفاعل)
-- ------------------------------------------------------------
create table if not exists public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  activity_type text not null,   -- 'lecture_view','video_watch','exam_attend','qr_scan','login'
  ref_id uuid,                   -- e.g. lecture id
  created_at timestamptz default now()
);

-- Recalculates streaks whenever a new activity is logged
create or replace function public.bump_streak()
returns trigger as $$
declare
  s record;
begin
  select * into s from public.streaks where user_id = new.user_id for update;

  if s.last_active_date is null then
    update public.streaks
      set current_streak = 1, longest_streak = greatest(1, longest_streak),
          last_active_date = current_date
      where user_id = new.user_id;
  elsif s.last_active_date = current_date then
    -- already counted today, no-op
    null;
  elsif s.last_active_date = current_date - 1 then
    update public.streaks
      set current_streak = s.current_streak + 1,
          longest_streak = greatest(s.longest_streak, s.current_streak + 1),
          last_active_date = current_date
      where user_id = new.user_id;
  else
    update public.streaks
      set current_streak = 1,
          last_active_date = current_date
      where user_id = new.user_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_activity_logged on public.activity_log;
create trigger on_activity_logged
  after insert on public.activity_log
  for each row execute procedure public.bump_streak();

-- ------------------------------------------------------------
-- 4. SAVED / ARCHIVE (bookmarked videos & questions)
-- ------------------------------------------------------------
create table if not exists public.saved_items (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  item_type text not null,     -- 'video' | 'question' | 'lecture'
  ref_id uuid,
  title text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 5. ATTENDANCE / EXAM QR SESSIONS
-- ------------------------------------------------------------
create table if not exists public.qr_sessions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,             -- 'محاضرة تشريح - حضور' etc
  session_type text default 'lecture', -- 'lecture' | 'exam'
  starts_at timestamptz default now(),
  expires_at timestamptz,
  is_active boolean default true
);

create table if not exists public.attendance_records (
  id bigint generated always as identity primary key,
  session_id uuid references public.qr_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  scanned_at timestamptz default now(),
  unique (session_id, user_id)
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.streaks enable row level security;
alter table public.activity_log enable row level security;
alter table public.saved_items enable row level security;
alter table public.attendance_records enable row level security;
alter table public.subjects enable row level security;
alter table public.lectures enable row level security;
alter table public.qr_sessions enable row level security;

-- Everyone (any authenticated user) can read subjects/lectures/qr_sessions
create policy "read subjects" on public.subjects for select using (true);
create policy "read lectures" on public.lectures for select using (true);
create policy "read qr sessions" on public.qr_sessions for select using (true);

-- Profiles: users read all (for public username display), edit only their own
create policy "read profiles" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

-- Streaks: only owner can read/write
create policy "own streak read" on public.streaks for select using (auth.uid() = user_id);
create policy "own streak update" on public.streaks for update using (auth.uid() = user_id);

-- Activity log: owner inserts & reads their own
create policy "own activity insert" on public.activity_log for insert with check (auth.uid() = user_id);
create policy "own activity read" on public.activity_log for select using (auth.uid() = user_id);

-- Saved items: owner only
create policy "own saved crud" on public.saved_items for all using (auth.uid() = user_id);

-- Attendance: owner inserts/reads own record
create policy "own attendance insert" on public.attendance_records for insert with check (auth.uid() = user_id);
create policy "own attendance read" on public.attendance_records for select using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Seed a couple of example subjects (optional — remove if unwanted)
-- ------------------------------------------------------------
insert into public.subjects (title, icon, color, sort_order) values
  ('تشريح الأسنان', '🦷', '#14304A', 1),
  ('علم الأمراض الفموي', '🧬', '#3FA796', 2),
  ('التعويضات السنية', '🦿', '#F4A340', 3),
  ('جراحة الفم والفكين', '🩺', '#C1440E', 4)
on conflict do nothing;
