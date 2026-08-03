alter table public.theatres
  drop constraint if exists theatres_primary_language_check;

alter table public.theatres
  add constraint theatres_primary_language_check
  check (primary_language in ('ca', 'es', 'en', 'pt-BR'));
