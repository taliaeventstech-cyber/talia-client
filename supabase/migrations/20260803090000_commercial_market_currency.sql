-- Country is the commercial market selected during onboarding. It is not the
-- billing address collected later by Stripe Checkout.
alter table public.accounts
  add column if not exists market_country_code text,
  add column if not exists billing_currency text not null default 'EUR';

alter table public.accounts
  drop constraint if exists accounts_market_country_code_check,
  add constraint accounts_market_country_code_check
    check (market_country_code is null or market_country_code in ('ES', 'MX', 'BR')),
  drop constraint if exists accounts_billing_currency_check,
  add constraint accounts_billing_currency_check
    check (billing_currency in ('EUR', 'MXN', 'BRL')),
  drop constraint if exists accounts_market_currency_pair_check,
  add constraint accounts_market_currency_pair_check
    check (
      market_country_code is null
      or (market_country_code = 'ES' and billing_currency = 'EUR')
      or (market_country_code = 'MX' and billing_currency = 'MXN')
      or (market_country_code = 'BR' and billing_currency = 'BRL')
    );

comment on column public.accounts.market_country_code is
  'Initial commercial market selected in onboarding; Stripe collects the billing country at checkout.';
comment on column public.accounts.billing_currency is
  'Currency assigned to the commercial market. Existing accounts remain in EUR.';
