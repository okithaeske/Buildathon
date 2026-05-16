-- LaunchPad AI — Supabase schema
-- Run in Supabase SQL Editor

-- User profiles (extends auth.users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  tier text default 'free',
  pitch_count int default 0,
  campaign_count int default 0,
  stripe_customer_id text,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Pitch sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  stage text default 'captured',
  idea_raw text,
  concept_summary jsonb,
  scan_result jsonb,
  scan_expires_at timestamptz,
  audit_result jsonb,
  refine_questions jsonb,
  refine_answers jsonb,
  refine_index int default 0,
  idea_profile jsonb,
  viability_score jsonb,
  pitch_output jsonb,
  audio_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Async jobs (pitch / campaign generation)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  type text not null,
  session_id uuid references public.sessions on delete set null,
  campaign_id uuid,
  status text default 'queued',
  progress text,
  result jsonb,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  product_url text,
  description text,
  tone text,
  reference_image_url text,
  ad_script text,
  taglines jsonb,
  captions jsonb,
  email_copy text,
  hero_copy text,
  video_url text,
  banner_url text,
  audio_url text,
  status text default 'processing',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS (optional — backend uses service role; enable for direct client access)
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.campaigns enable row level security;
alter table public.jobs enable row level security;

create policy "Users read own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users read own sessions" on public.sessions
  for all using (auth.uid() = user_id);

create policy "Users read own campaigns" on public.campaigns
  for all using (auth.uid() = user_id);

create policy "Users read own jobs" on public.jobs
  for all using (auth.uid() = user_id);

-- Storage buckets (create in dashboard): audio, images, exports
