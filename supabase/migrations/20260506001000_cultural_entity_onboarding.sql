alter table public.theatres
  add column if not exists entity_type text not null default 'theatre',
  add column if not exists primary_language text not null default 'es',
  add column if not exists website_url text,
  add column if not exists onboarding_goals jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_completed boolean not null default false;

alter table public.theatres
  drop constraint if exists theatres_entity_type_check;

alter table public.theatres
  add constraint theatres_entity_type_check check (
    entity_type in ('theatre', 'museum', 'cinema', 'auditorium', 'festival', 'cultural_center', 'other')
  );

alter table public.theatres
  drop constraint if exists theatres_primary_language_check;

alter table public.theatres
  add constraint theatres_primary_language_check check (primary_language in ('ca', 'es', 'en'));

update public.theatres
set website_url = coalesce(website_url, scrape_urls->>0)
where website_url is null
  and jsonb_typeof(scrape_urls) = 'array'
  and jsonb_array_length(scrape_urls) > 0;
