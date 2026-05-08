alter table public.theatres
  add column if not exists voice_phone_provider text not null default 'elevenlabs',
  add column if not exists voice_phone_mode text not null default 'talia_number',
  add column if not exists voice_public_phone_number text,
  add column if not exists voice_forwarding_notes text,
  add column if not exists voice_operational_status text not null default 'draft';

alter table public.theatres
  drop constraint if exists theatres_voice_phone_provider_check;

alter table public.theatres
  add constraint theatres_voice_phone_provider_check check (
    voice_phone_provider in ('elevenlabs', 'twilio', 'external')
  );

alter table public.theatres
  drop constraint if exists theatres_voice_phone_mode_check;

alter table public.theatres
  add constraint theatres_voice_phone_mode_check check (
    voice_phone_mode in ('talia_number', 'client_forwarding', 'portability')
  );

alter table public.theatres
  drop constraint if exists theatres_voice_operational_status_check;

alter table public.theatres
  add constraint theatres_voice_operational_status_check check (
    voice_operational_status in ('draft', 'provisioning', 'active', 'paused', 'error')
  );

notify pgrst, 'reload schema';
