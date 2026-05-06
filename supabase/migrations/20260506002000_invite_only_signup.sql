create table if not exists public.signup_invites (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  role public.user_role not null default 'admin',
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signup_invites_email_lowercase check (email = lower(email)),
  constraint signup_invites_token_hash_length check (char_length(token_hash) = 64)
);

alter table public.signup_invites enable row level security;

create index if not exists signup_invites_theatre_idx
  on public.signup_invites(theatre_id, created_at desc);

create index if not exists signup_invites_email_idx
  on public.signup_invites(email);

create index if not exists signup_invites_pending_idx
  on public.signup_invites(token_hash)
  where accepted_at is null and revoked_at is null;

drop trigger if exists signup_invites_updated_at on public.signup_invites;
create trigger signup_invites_updated_at
  before update on public.signup_invites
  for each row execute function public.set_updated_at();
