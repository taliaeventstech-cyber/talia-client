alter table public.signup_invites
  alter column theatre_id drop not null;

alter table public.signup_invites
  drop constraint if exists signup_invites_theatre_id_fkey;

alter table public.signup_invites
  add constraint signup_invites_theatre_id_fkey
  foreign key (theatre_id) references public.theatres(id) on delete set null;

create index if not exists signup_invites_account_pending_idx
  on public.signup_invites(account_id, created_at desc)
  where accepted_at is null and revoked_at is null;

notify pgrst, 'reload schema';
