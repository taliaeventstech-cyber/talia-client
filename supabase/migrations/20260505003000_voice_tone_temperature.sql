alter table public.theatres
  add column if not exists voice_tone        text not null default 'warm',
  add column if not exists voice_temperature integer not null default 50;

alter table public.theatres
  add constraint voice_temperature_range check (voice_temperature between 0 and 100);
