create table if not exists public.knowledge_source_support_requests (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  sync_run_id uuid references public.knowledge_sync_runs(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  idempotency_key uuid not null,
  customer_message text not null,
  error_code text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  delivery_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_source_support_message_length
    check (char_length(trim(customer_message)) between 1 and 2000),
  constraint knowledge_source_support_error_code_length
    check (error_code is null or char_length(error_code) <= 120),
  constraint knowledge_source_support_delivery_error_length
    check (delivery_error is null or char_length(delivery_error) <= 500),
  constraint knowledge_source_support_source_theatre_fkey
    foreign key (source_id, theatre_id)
    references public.knowledge_sources(id, theatre_id)
    on delete cascade,
  constraint knowledge_source_support_idempotency_key
    unique (theatre_id, idempotency_key)
);

alter table public.knowledge_source_support_requests enable row level security;

drop policy if exists "knowledge_source_support_select_own_theatre"
  on public.knowledge_source_support_requests;
create policy "knowledge_source_support_select_own_theatre"
  on public.knowledge_source_support_requests
  for select
  using (theatre_id in (select public.current_theatre_ids()));

create index if not exists knowledge_source_support_theatre_created_idx
  on public.knowledge_source_support_requests(theatre_id, created_at desc);

create index if not exists knowledge_source_support_open_idx
  on public.knowledge_source_support_requests(status, created_at)
  where status in ('open', 'in_progress');

drop trigger if exists knowledge_source_support_updated_at
  on public.knowledge_source_support_requests;
create trigger knowledge_source_support_updated_at
  before update on public.knowledge_source_support_requests
  for each row execute function public.set_updated_at();
