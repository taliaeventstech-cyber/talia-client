create table if not exists public.widget_installations (
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  origin text not null check (char_length(origin) between 8 and 2048),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (theatre_id, origin)
);

create index if not exists widget_installations_last_seen_idx
  on public.widget_installations (theatre_id, last_seen_at desc);

alter table public.widget_installations enable row level security;

create or replace function public.record_widget_installation(
  p_theatre_id uuid,
  p_origin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_theatre_id is null
     or p_origin is null
     or char_length(p_origin) < 8
     or char_length(p_origin) > 2048 then
    return false;
  end if;

  insert into public.widget_installations (theatre_id, origin)
  values (p_theatre_id, p_origin)
  on conflict (theatre_id, origin) do update
    set last_seen_at = now()
    where public.widget_installations.last_seen_at <= now() - interval '5 minutes';

  return true;
end;
$$;

revoke all on table public.widget_installations from public, anon, authenticated;
revoke all on function public.record_widget_installation(uuid, text) from public, anon, authenticated;
grant all on table public.widget_installations to service_role;
grant execute on function public.record_widget_installation(uuid, text) to service_role;
