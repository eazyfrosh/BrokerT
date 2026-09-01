-- =====================================================================
-- BrokerT — complete database setup
-- =====================================================================
-- Paste the whole file into the Supabase SQL Editor and run it once.
--
-- Safe to re-run: enum creation is guarded, tables use IF NOT EXISTS,
-- policies are dropped before being recreated, functions use CREATE OR
-- REPLACE, and the candle generator returns early if history exists.
--
-- Verified against PostgreSQL 16 from empty, twice, by scripts/verify-db.sh.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0001_schema.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — core schema
-- =====================================================================
-- Conventions:
--   * every table uses a uuid primary key (gen_random_uuid)
--   * every mutable table carries created_at / updated_at (trigger-managed)
--   * money is numeric(20,8) so quantity maths never loses precision
--   * user-scoped tables denormalise user_id so RLS stays a single-column check
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('user', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('pending', 'active', 'suspended', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kyc_status as enum ('not_started', 'pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_side as enum ('buy', 'sell');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_type as enum ('market', 'limit', 'stop', 'stop_limit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'submitted', 'filled', 'partially_filled', 'cancelled', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type time_in_force as enum ('day', 'gtc', 'ioc', 'fok');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum (
    'deposit', 'withdrawal', 'buy', 'sell', 'investment', 'investment_return', 'fee', 'refund'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_status as enum ('pending', 'processing', 'completed', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_level as enum ('conservative', 'moderate', 'balanced', 'growth', 'aggressive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type investment_status as enum ('draft', 'open', 'paused', 'closed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type investment_position_status as enum ('active', 'matured', 'withdrawn', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type car_order_status as enum (
    'configuration', 'order_request', 'processing', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'order_filled', 'order_update', 'investment_update', 'portfolio_alert',
    'security_alert', 'new_investment', 'car_order_update', 'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type support_ticket_status as enum ('open', 'pending', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type support_ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_preference as enum ('light', 'dark', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_option_kind as enum ('trim', 'exterior', 'interior', 'wheels', 'option');
exception when duplicate_object then null; end $$;

do $$ begin
  create type login_event_kind as enum ('login', 'logout', 'failed_login', 'password_change', 'password_reset');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  country text,
  avatar_url text,
  role user_role not null default 'user',
  account_status account_status not null default 'active',
  kyc_status kyc_status not null default 'not_started',
  two_factor_enabled boolean not null default false,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_format check (position('@' in email) > 1)
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (account_status);
create index if not exists profiles_created_idx on public.profiles (created_at desc);
create index if not exists profiles_email_trgm_idx on public.profiles using gin (email gin_trgm_ops);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies never recurse into profiles)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select account_status = 'active' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme theme_preference not null default 'system',
  email_order_updates boolean not null default true,
  email_investment_updates boolean not null default true,
  email_security_alerts boolean not null default true,
  email_marketing boolean not null default false,
  push_enabled boolean not null default false,
  base_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- wallets
-- ---------------------------------------------------------------------
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null default 'USD',
  available_balance numeric(20,2) not null default 0,
  pending_balance numeric(20,2) not null default 0,
  reserved_balance numeric(20,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_user_currency_key unique (user_id, currency),
  constraint wallets_available_non_negative check (available_balance >= 0),
  constraint wallets_pending_non_negative check (pending_balance >= 0),
  constraint wallets_reserved_non_negative check (reserved_balance >= 0)
);

drop trigger if exists wallets_updated_at on public.wallets;
create trigger wallets_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- assets & market data
-- ---------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text not null,
  exchange text,
  asset_class text not null default 'equity',
  currency text not null default 'USD',
  sector text,
  description text,
  logo_url text,
  is_tradable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists assets_updated_at on public.assets;
create trigger assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();

create table if not exists public.market_quotes (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references public.assets(id) on delete cascade,
  price numeric(20,4) not null,
  previous_close numeric(20,4) not null,
  open_price numeric(20,4) not null,
  day_high numeric(20,4) not null,
  day_low numeric(20,4) not null,
  volume bigint not null default 0,
  market_cap numeric(24,2),
  week52_high numeric(20,4),
  week52_low numeric(20,4),
  source text not null default 'simulated',
  is_simulated boolean not null default true,
  quoted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_quotes_price_positive check (price > 0)
);

drop trigger if exists market_quotes_updated_at on public.market_quotes;
create trigger market_quotes_updated_at before update on public.market_quotes
  for each row execute function public.set_updated_at();

create table if not exists public.market_candles (
  asset_id uuid not null references public.assets(id) on delete cascade,
  interval text not null,
  bucket_start timestamptz not null,
  open numeric(20,4) not null,
  high numeric(20,4) not null,
  low numeric(20,4) not null,
  close numeric(20,4) not null,
  volume bigint not null default 0,
  is_simulated boolean not null default true,
  primary key (asset_id, interval, bucket_start)
);

create index if not exists market_candles_lookup_idx
  on public.market_candles (asset_id, interval, bucket_start desc);

-- ---------------------------------------------------------------------
-- portfolios & holdings
-- ---------------------------------------------------------------------
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Main portfolio',
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolios_user_name_key unique (user_id, name)
);

drop trigger if exists portfolios_updated_at on public.portfolios;
create trigger portfolios_updated_at before update on public.portfolios
  for each row execute function public.set_updated_at();

create table if not exists public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  quantity numeric(20,8) not null default 0,
  average_cost numeric(20,8) not null default 0,
  realized_pnl numeric(20,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_holdings_unique unique (portfolio_id, asset_id),
  constraint portfolio_holdings_quantity_non_negative check (quantity >= 0),
  constraint portfolio_holdings_cost_non_negative check (average_cost >= 0)
);

create index if not exists portfolio_holdings_user_idx on public.portfolio_holdings (user_id);

drop trigger if exists portfolio_holdings_updated_at on public.portfolio_holdings;
create trigger portfolio_holdings_updated_at before update on public.portfolio_holdings
  for each row execute function public.set_updated_at();

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  captured_on date not null,
  total_value numeric(20,2) not null,
  holdings_value numeric(20,2) not null,
  cash_balance numeric(20,2) not null,
  invested_value numeric(20,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint portfolio_snapshots_unique unique (user_id, captured_on)
);

create index if not exists portfolio_snapshots_user_date_idx
  on public.portfolio_snapshots (user_id, captured_on desc);

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  side order_side not null,
  order_type order_type not null,
  time_in_force time_in_force not null default 'day',
  quantity numeric(20,8) not null,
  filled_quantity numeric(20,8) not null default 0,
  limit_price numeric(20,4),
  stop_price numeric(20,4),
  estimated_price numeric(20,4),
  average_fill_price numeric(20,4),
  fees numeric(20,2) not null default 0,
  status order_status not null default 'pending',
  rejection_reason text,
  is_simulated boolean not null default true,
  submitted_at timestamptz,
  filled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_quantity_positive check (quantity > 0),
  constraint orders_filled_within_quantity check (filled_quantity >= 0 and filled_quantity <= quantity),
  constraint orders_limit_price_required check (
    (order_type in ('limit', 'stop_limit') and limit_price is not null and limit_price > 0)
    or (order_type not in ('limit', 'stop_limit'))
  ),
  constraint orders_stop_price_required check (
    (order_type in ('stop', 'stop_limit') and stop_price is not null and stop_price > 0)
    or (order_type not in ('stop', 'stop_limit'))
  )
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_asset_idx on public.orders (asset_id);
create index if not exists orders_reference_trgm_idx on public.orders using gin (reference gin_trgm_ops);

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_fills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity numeric(20,8) not null,
  price numeric(20,4) not null,
  fees numeric(20,2) not null default 0,
  filled_at timestamptz not null default now(),
  constraint order_fills_quantity_positive check (quantity > 0),
  constraint order_fills_price_positive check (price > 0)
);

create index if not exists order_fills_order_idx on public.order_fills (order_id);
create index if not exists order_fills_user_idx on public.order_fills (user_id);

-- ---------------------------------------------------------------------
-- investments
-- ---------------------------------------------------------------------
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'Thematic',
  summary text not null,
  description text,
  objective text,
  risk_level risk_level not null default 'balanced',
  risk_disclosure text,
  terms text,
  target_return_pct numeric(8,2) not null default 0,
  duration_months integer not null default 12,
  minimum_amount numeric(20,2) not null default 0,
  maximum_amount numeric(20,2),
  management_fee_pct numeric(6,3) not null default 0,
  performance_fee_pct numeric(6,3) not null default 0,
  capacity_amount numeric(20,2),
  raised_amount numeric(20,2) not null default 0,
  status investment_status not null default 'draft',
  image_url text,
  is_simulated boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investments_duration_positive check (duration_months > 0),
  constraint investments_minimum_non_negative check (minimum_amount >= 0),
  constraint investments_max_gte_min check (maximum_amount is null or maximum_amount >= minimum_amount)
);

create index if not exists investments_status_idx on public.investments (status);

drop trigger if exists investments_updated_at on public.investments;
create trigger investments_updated_at before update on public.investments
  for each row execute function public.set_updated_at();

create table if not exists public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete restrict,
  principal numeric(20,2) not null,
  current_value numeric(20,2) not null,
  target_return_pct numeric(8,2) not null default 0,
  start_date date not null default current_date,
  target_date date not null,
  status investment_position_status not null default 'active',
  is_simulated boolean not null default true,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_positions_principal_positive check (principal > 0),
  constraint investment_positions_dates check (target_date >= start_date)
);

create index if not exists investment_positions_user_idx on public.investment_positions (user_id, created_at desc);
create index if not exists investment_positions_investment_idx on public.investment_positions (investment_id);

drop trigger if exists investment_positions_updated_at on public.investment_positions;
create trigger investment_positions_updated_at before update on public.investment_positions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- vehicles & car orders
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  model_name text not null,
  tagline text,
  description text,
  base_price numeric(20,2) not null,
  range_miles integer not null default 0,
  top_speed_mph integer not null default 0,
  acceleration_0_60 numeric(5,2) not null default 0,
  drive_type text not null default 'Rear-Wheel Drive',
  seating integer not null default 5,
  features text[] not null default '{}',
  image_url text,
  is_available boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_base_price_positive check (base_price > 0)
);

drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

create table if not exists public.vehicle_options (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  kind vehicle_option_kind not null,
  code text not null,
  name text not null,
  description text,
  price_delta numeric(20,2) not null default 0,
  swatch text,
  range_delta_miles integer not null default 0,
  is_default boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint vehicle_options_unique unique (vehicle_id, kind, code)
);

create index if not exists vehicle_options_vehicle_idx on public.vehicle_options (vehicle_id, kind, display_order);

create table if not exists public.car_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  configuration jsonb not null default '{}'::jsonb,
  configuration_summary text,
  total_price numeric(20,2) not null,
  deposit_amount numeric(20,2) not null default 0,
  status car_order_status not null default 'order_request',
  delivery_full_name text,
  delivery_email text,
  delivery_phone text,
  delivery_address_line1 text,
  delivery_address_line2 text,
  delivery_city text,
  delivery_region text,
  delivery_postal_code text,
  delivery_country text,
  estimated_delivery date,
  internal_notes text,
  is_simulated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint car_orders_total_positive check (total_price > 0)
);

create index if not exists car_orders_user_idx on public.car_orders (user_id, created_at desc);
create index if not exists car_orders_status_idx on public.car_orders (status);

drop trigger if exists car_orders_updated_at on public.car_orders;
create trigger car_orders_updated_at before update on public.car_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type transaction_type not null,
  status transaction_status not null default 'completed',
  amount numeric(20,2) not null,
  currency text not null default 'USD',
  balance_after numeric(20,2),
  description text,
  related_order_id uuid references public.orders(id) on delete set null,
  related_investment_position_id uuid references public.investment_positions(id) on delete set null,
  related_car_order_id uuid references public.car_orders(id) on delete set null,
  payment_method text,
  is_simulated boolean not null default true,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index if not exists transactions_type_idx on public.transactions (type);
create index if not exists transactions_status_idx on public.transactions (status);
create index if not exists transactions_reference_trgm_idx on public.transactions using gin (reference gin_trgm_ops);

drop trigger if exists transactions_updated_at on public.transactions;
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- watchlists
-- ---------------------------------------------------------------------
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My watchlist',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlists_user_name_key unique (user_id, name)
);

drop trigger if exists watchlists_updated_at on public.watchlists;
create trigger watchlists_updated_at before update on public.watchlists
  for each row execute function public.set_updated_at();

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  constraint watchlist_items_unique unique (watchlist_id, asset_id)
);

create index if not exists watchlist_items_user_idx on public.watchlist_items (user_id);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type notification_type not null default 'system',
  title text not null,
  message text not null,
  link text,
  read_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- support
-- ---------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  category text not null default 'General',
  priority support_ticket_priority not null default 'normal',
  status support_ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status);

drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------
-- audit & security
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  description text,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event login_event_kind not null,
  ip_address inet,
  user_agent text,
  location text,
  succeeded boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists login_events_user_idx on public.login_events (user_id, created_at desc);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists system_settings_updated_at on public.system_settings;
create trigger system_settings_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 0002_functions.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — provisioning triggers and transactional business functions
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reference generator: short, unambiguous, collision-checked.
-- ---------------------------------------------------------------------
create or replace function public.generate_reference(p_prefix text, p_table regclass)
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  exists_already boolean;
  attempt int := 0;
begin
  loop
    candidate := p_prefix || '-';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    execute format('select exists (select 1 from %s where reference = $1)', p_table)
      into exists_already
      using candidate;

    exit when not exists_already;

    attempt := attempt + 1;
    if attempt > 12 then
      raise exception 'Could not allocate a unique reference for %', p_table;
    end if;
  end loop;

  return candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- Provision every new auth user with the records the app assumes exist.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
  v_watchlist_id uuid;
  v_asset_id uuid;
begin
  insert into public.profiles (id, email, first_name, last_name, phone, country, email_verified_at)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'country', ''),
    new.email_confirmed_at
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  insert into public.wallets (user_id, currency) values (new.id, 'USD') on conflict do nothing;

  insert into public.portfolios (user_id, name) values (new.id, 'Main portfolio')
  on conflict (user_id, name) do nothing
  returning id into v_portfolio_id;

  insert into public.watchlists (user_id, name, is_default) values (new.id, 'My watchlist', true)
  on conflict (user_id, name) do nothing
  returning id into v_watchlist_id;

  -- Seed the watchlist with the platform's primary instrument when available.
  select id into v_asset_id from public.assets where symbol = 'TSLA';
  if v_watchlist_id is not null and v_asset_id is not null then
    insert into public.watchlist_items (watchlist_id, user_id, asset_id)
    values (v_watchlist_id, new.id, v_asset_id)
    on conflict do nothing;
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.id,
    'system',
    'Welcome to BrokerT',
    'Your account is ready. BrokerT is an independent Tesla-focused platform running in demo mode — prices, balances and orders are simulated.',
    '/dashboard'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email / verification in sync when auth.users changes.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email = new.email,
         email_verified_at = new.email_confirmed_at,
         last_login_at = coalesce(new.last_sign_in_at, last_login_at)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------
-- place_order — the single, atomic write path for trading.
--
-- Performs, inside one transaction:
--   * caller authorisation and account-status checks
--   * server-side price resolution (the client never dictates fill price)
--   * buying-power / position checks
--   * order + fill + holding + wallet + transaction + notification writes
--
-- Marketable orders fill immediately against the current quote (demo venue).
-- Non-marketable limit/stop orders rest as 'submitted' and reserve funds.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_asset_id uuid,
  p_side order_side,
  p_order_type order_type,
  p_quantity numeric,
  p_limit_price numeric default null,
  p_stop_price numeric default null,
  p_time_in_force time_in_force default 'day'
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status account_status;
  v_asset public.assets;
  v_quote public.market_quotes;
  v_wallet public.wallets;
  v_portfolio_id uuid;
  v_holding public.portfolio_holdings;
  v_reference text;
  v_price numeric(20,4);
  v_notional numeric(20,2);
  v_fees numeric(20,2);
  v_total numeric(20,2);
  v_marketable boolean;
  v_order public.orders;
  v_new_qty numeric(20,8);
  v_new_avg numeric(20,8);
  v_realized numeric(20,2);
  v_balance_after numeric(20,2);
  v_sell_fee_rate constant numeric := 0.0000278;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select account_status into v_status from public.profiles where id = v_user_id;
  if v_status is null then
    raise exception 'PROFILE_MISSING' using errcode = 'P0002';
  end if;
  if v_status <> 'active' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  select * into v_asset from public.assets where id = p_asset_id;
  if v_asset.id is null then
    raise exception 'ASSET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_asset.is_tradable then
    raise exception 'ASSET_NOT_TRADABLE' using errcode = 'P0001';
  end if;

  select * into v_quote from public.market_quotes where asset_id = p_asset_id;
  if v_quote.id is null then
    raise exception 'QUOTE_UNAVAILABLE' using errcode = 'P0002';
  end if;

  if p_order_type in ('limit', 'stop_limit') and (p_limit_price is null or p_limit_price <= 0) then
    raise exception 'LIMIT_PRICE_REQUIRED' using errcode = '22023';
  end if;
  if p_order_type in ('stop', 'stop_limit') and (p_stop_price is null or p_stop_price <= 0) then
    raise exception 'STOP_PRICE_REQUIRED' using errcode = '22023';
  end if;

  -- Marketability against the current quote.
  v_marketable := case p_order_type
    when 'market' then true
    when 'limit' then (p_side = 'buy' and v_quote.price <= p_limit_price)
                   or (p_side = 'sell' and v_quote.price >= p_limit_price)
    when 'stop' then (p_side = 'buy' and v_quote.price >= p_stop_price)
                  or (p_side = 'sell' and v_quote.price <= p_stop_price)
    when 'stop_limit' then (
        (p_side = 'buy' and v_quote.price >= p_stop_price and v_quote.price <= p_limit_price)
     or (p_side = 'sell' and v_quote.price <= p_stop_price and v_quote.price >= p_limit_price)
    )
  end;

  -- Fill price is always the server-held quote, bounded by any limit.
  v_price := v_quote.price;
  if p_order_type in ('limit', 'stop_limit') then
    if p_side = 'buy' then
      v_price := least(v_quote.price, p_limit_price);
    else
      v_price := greatest(v_quote.price, p_limit_price);
    end if;
  end if;

  v_notional := round(p_quantity * v_price, 2);
  v_fees := case when p_side = 'sell' then round(v_notional * v_sell_fee_rate, 2) else 0 end;
  v_total := case when p_side = 'buy' then v_notional + v_fees else v_notional - v_fees end;

  select * into v_wallet from public.wallets where user_id = v_user_id and currency = v_asset.currency for update;
  if v_wallet.id is null then
    raise exception 'WALLET_MISSING' using errcode = 'P0002';
  end if;

  select id into v_portfolio_id from public.portfolios where user_id = v_user_id order by created_at limit 1;
  if v_portfolio_id is null then
    insert into public.portfolios (user_id, name) values (v_user_id, 'Main portfolio') returning id into v_portfolio_id;
  end if;

  select * into v_holding
    from public.portfolio_holdings
   where portfolio_id = v_portfolio_id and asset_id = p_asset_id
     for update;

  -- Pre-trade risk checks.
  if p_side = 'buy' then
    if v_wallet.available_balance < (v_notional + v_fees) then
      raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
    end if;
  else
    if coalesce(v_holding.quantity, 0) < p_quantity then
      raise exception 'INSUFFICIENT_POSITION' using errcode = 'P0001';
    end if;
  end if;

  v_reference := public.generate_reference('ORD', 'public.orders');

  insert into public.orders (
    reference, user_id, asset_id, side, order_type, time_in_force,
    quantity, limit_price, stop_price, estimated_price, status, submitted_at, is_simulated
  ) values (
    v_reference, v_user_id, p_asset_id, p_side, p_order_type, p_time_in_force,
    p_quantity, p_limit_price, p_stop_price, v_quote.price, 'submitted', now(), v_quote.is_simulated
  ) returning * into v_order;

  if not v_marketable then
    -- Resting order: reserve buying power so the balance cannot be double-spent.
    if p_side = 'buy' then
      update public.wallets
         set available_balance = available_balance - (v_notional + v_fees),
             reserved_balance = reserved_balance + (v_notional + v_fees)
       where id = v_wallet.id;
    end if;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      v_user_id, 'order_update', 'Order submitted',
      format('%s order %s for %s %s is working and will fill when the market reaches your price.',
             initcap(p_side::text), v_reference, trim(to_char(p_quantity, 'FM999999990.######')), v_asset.symbol),
      '/orders'
    );

    return v_order;
  end if;

  -- ---- Immediate fill -------------------------------------------------
  insert into public.order_fills (order_id, user_id, quantity, price, fees)
  values (v_order.id, v_user_id, p_quantity, v_price, v_fees);

  if p_side = 'buy' then
    v_balance_after := v_wallet.available_balance - v_total;

    update public.wallets
       set available_balance = v_balance_after
     where id = v_wallet.id;

    if v_holding.id is null then
      insert into public.portfolio_holdings (portfolio_id, user_id, asset_id, quantity, average_cost)
      values (v_portfolio_id, v_user_id, p_asset_id, p_quantity, v_price);
    else
      v_new_qty := v_holding.quantity + p_quantity;
      v_new_avg := ((v_holding.quantity * v_holding.average_cost) + (p_quantity * v_price)) / v_new_qty;
      update public.portfolio_holdings
         set quantity = v_new_qty, average_cost = v_new_avg
       where id = v_holding.id;
    end if;
  else
    v_balance_after := v_wallet.available_balance + v_total;

    update public.wallets
       set available_balance = v_balance_after
     where id = v_wallet.id;

    v_realized := round((v_price - v_holding.average_cost) * p_quantity, 2);
    v_new_qty := v_holding.quantity - p_quantity;

    update public.portfolio_holdings
       set quantity = v_new_qty,
           average_cost = case when v_new_qty = 0 then 0 else v_holding.average_cost end,
           realized_pnl = v_holding.realized_pnl + v_realized
     where id = v_holding.id;
  end if;

  update public.orders
     set status = 'filled',
         filled_quantity = p_quantity,
         average_fill_price = v_price,
         fees = v_fees,
         filled_at = now()
   where id = v_order.id
   returning * into v_order;

  insert into public.transactions (
    reference, user_id, type, status, amount, currency, balance_after,
    description, related_order_id, is_simulated, processed_at
  ) values (
    public.generate_reference('TXN', 'public.transactions'),
    v_user_id,
    case when p_side = 'buy' then 'buy'::transaction_type else 'sell'::transaction_type end,
    'completed',
    case when p_side = 'buy' then -v_total else v_total end,
    v_asset.currency,
    v_balance_after,
    format('%s %s %s @ %s', initcap(p_side::text),
           trim(to_char(p_quantity, 'FM999999990.######')), v_asset.symbol,
           to_char(v_price, 'FM999999990.00')),
    v_order.id,
    v_quote.is_simulated,
    now()
  );

  if v_fees > 0 then
    insert into public.transactions (
      reference, user_id, type, status, amount, currency, balance_after,
      description, related_order_id, is_simulated, processed_at
    ) values (
      public.generate_reference('TXN', 'public.transactions'),
      v_user_id, 'fee', 'completed', -v_fees, v_asset.currency, v_balance_after,
      format('Regulatory fee on order %s', v_reference), v_order.id, v_quote.is_simulated, now()
    );
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    v_user_id, 'order_filled', 'Order filled',
    format('%s %s %s filled at %s (order %s).', initcap(p_side::text),
           trim(to_char(p_quantity, 'FM999999990.######')), v_asset.symbol,
           to_char(v_price, 'FM999999990.00'), v_reference),
    '/orders'
  );

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_order — releases reserved buying power for resting buy orders.
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
  v_asset public.assets;
  v_reserved numeric(20,2);
  v_price numeric(20,4);
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.user_id <> v_user_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_order.status not in ('pending', 'submitted', 'partially_filled') then
    raise exception 'ORDER_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  select * into v_asset from public.assets where id = v_order.asset_id;

  if v_order.side = 'buy' then
    v_price := coalesce(v_order.limit_price, v_order.estimated_price, 0);
    v_reserved := round((v_order.quantity - v_order.filled_quantity) * v_price, 2);
    if v_reserved > 0 then
      update public.wallets
         set reserved_balance = greatest(reserved_balance - v_reserved, 0),
             available_balance = available_balance + least(reserved_balance, v_reserved)
       where user_id = v_order.user_id and currency = v_asset.currency;
    end if;
  end if;

  update public.orders
     set status = 'cancelled', cancelled_at = now()
   where id = v_order.id
   returning * into v_order;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_order.user_id, 'order_update', 'Order cancelled',
          format('Order %s was cancelled.', v_order.reference), '/orders');

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- create_investment_position — debits cash and opens a position atomically.
-- ---------------------------------------------------------------------
create or replace function public.create_investment_position(
  p_investment_id uuid,
  p_amount numeric
)
returns public.investment_positions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status account_status;
  v_investment public.investments;
  v_wallet public.wallets;
  v_position public.investment_positions;
  v_balance_after numeric(20,2);
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select account_status into v_status from public.profiles where id = v_user_id;
  if v_status <> 'active' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select * into v_investment from public.investments where id = p_investment_id;
  if v_investment.id is null then
    raise exception 'INVESTMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_investment.status <> 'open' then
    raise exception 'INVESTMENT_NOT_OPEN' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if p_amount < v_investment.minimum_amount then
    raise exception 'BELOW_MINIMUM' using errcode = 'P0001';
  end if;
  if v_investment.maximum_amount is not null and p_amount > v_investment.maximum_amount then
    raise exception 'ABOVE_MAXIMUM' using errcode = 'P0001';
  end if;
  if v_investment.capacity_amount is not null
     and (v_investment.raised_amount + p_amount) > v_investment.capacity_amount then
    raise exception 'CAPACITY_EXCEEDED' using errcode = 'P0001';
  end if;

  select * into v_wallet from public.wallets where user_id = v_user_id and currency = 'USD' for update;
  if v_wallet.id is null then
    raise exception 'WALLET_MISSING' using errcode = 'P0002';
  end if;
  if v_wallet.available_balance < p_amount then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  v_balance_after := v_wallet.available_balance - p_amount;
  update public.wallets set available_balance = v_balance_after where id = v_wallet.id;

  insert into public.investment_positions (
    reference, user_id, investment_id, principal, current_value,
    target_return_pct, start_date, target_date, status, is_simulated
  ) values (
    public.generate_reference('INV', 'public.investment_positions'),
    v_user_id, v_investment.id, p_amount, p_amount,
    v_investment.target_return_pct, current_date,
    (current_date + (v_investment.duration_months || ' months')::interval)::date,
    'active', v_investment.is_simulated
  ) returning * into v_position;

  update public.investments
     set raised_amount = raised_amount + p_amount
   where id = v_investment.id;

  insert into public.transactions (
    reference, user_id, type, status, amount, currency, balance_after,
    description, related_investment_position_id, is_simulated, processed_at
  ) values (
    public.generate_reference('TXN', 'public.transactions'),
    v_user_id, 'investment', 'completed', -p_amount, 'USD', v_balance_after,
    format('Allocation to %s (%s)', v_investment.name, v_position.reference),
    v_position.id, v_investment.is_simulated, now()
  );

  insert into public.notifications (user_id, type, title, message, link)
  values (
    v_user_id, 'investment_update', 'Allocation confirmed',
    format('Your allocation of %s to %s is active. Target return is illustrative, not guaranteed.',
           to_char(p_amount, 'FM999,999,990.00'), v_investment.name),
    '/investments/active'
  );

  return v_position;
end;
$$;

-- ---------------------------------------------------------------------
-- create_car_order — records a vehicle order request (no money movement).
-- ---------------------------------------------------------------------
create or replace function public.create_car_order(
  p_vehicle_id uuid,
  p_configuration jsonb,
  p_configuration_summary text,
  p_total_price numeric,
  p_delivery jsonb
)
returns public.car_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_vehicle public.vehicles;
  v_order public.car_orders;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if v_vehicle.id is null then
    raise exception 'VEHICLE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_vehicle.is_available then
    raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_total_price is null or p_total_price <= 0 then
    raise exception 'INVALID_TOTAL' using errcode = '22023';
  end if;

  insert into public.car_orders (
    reference, user_id, vehicle_id, configuration, configuration_summary, total_price,
    deposit_amount, status,
    delivery_full_name, delivery_email, delivery_phone,
    delivery_address_line1, delivery_address_line2, delivery_city,
    delivery_region, delivery_postal_code, delivery_country,
    estimated_delivery
  ) values (
    public.generate_reference('CAR', 'public.car_orders'),
    v_user_id, v_vehicle.id, p_configuration, p_configuration_summary, p_total_price,
    0, 'order_request',
    p_delivery ->> 'full_name', p_delivery ->> 'email', p_delivery ->> 'phone',
    p_delivery ->> 'address_line1', p_delivery ->> 'address_line2', p_delivery ->> 'city',
    p_delivery ->> 'region', p_delivery ->> 'postal_code', p_delivery ->> 'country',
    (current_date + interval '90 days')::date
  ) returning * into v_order;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    v_user_id, 'car_order_update', 'Vehicle order request received',
    format('Order request %s for the %s has been recorded. This is a simulated marketplace request, not a purchase.',
           v_order.reference, v_vehicle.model_name),
    '/car-orders'
  );

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Demo cash movements. Explicitly refuse to run outside demo mode so that
-- production deployments must wire a real payment provider instead.
-- ---------------------------------------------------------------------
create or replace function public.demo_cash_movement(
  p_type transaction_type,
  p_amount numeric,
  p_method text default 'demo'
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets;
  v_txn public.transactions;
  v_demo boolean;
  v_balance_after numeric(20,2);
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select coalesce((value ->> 'enabled')::boolean, false) into v_demo
    from public.system_settings where key = 'demo_mode';

  if not coalesce(v_demo, false) then
    raise exception 'DEMO_MODE_DISABLED' using errcode = 'P0001';
  end if;

  if p_type not in ('deposit', 'withdrawal') then
    raise exception 'INVALID_TYPE' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if p_amount > 1000000 then
    raise exception 'AMOUNT_TOO_LARGE' using errcode = 'P0001';
  end if;

  select * into v_wallet from public.wallets where user_id = v_user_id and currency = 'USD' for update;
  if v_wallet.id is null then
    raise exception 'WALLET_MISSING' using errcode = 'P0002';
  end if;

  if p_type = 'withdrawal' and v_wallet.available_balance < p_amount then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  v_balance_after := v_wallet.available_balance
    + case when p_type = 'deposit' then p_amount else -p_amount end;

  update public.wallets set available_balance = v_balance_after where id = v_wallet.id;

  insert into public.transactions (
    reference, user_id, type, status, amount, currency, balance_after,
    description, payment_method, is_simulated, processed_at
  ) values (
    public.generate_reference('TXN', 'public.transactions'),
    v_user_id, p_type, 'completed',
    case when p_type = 'deposit' then p_amount else -p_amount end,
    'USD', v_balance_after,
    case when p_type = 'deposit'
         then 'Simulated demo funding — no real money was received'
         else 'Simulated demo withdrawal — no real money was sent' end,
    p_method, true, now()
  ) returning * into v_txn;

  return v_txn;
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications helpers
-- ---------------------------------------------------------------------
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  with updated as (
    update public.notifications
       set read_at = now()
     where user_id = auth.uid() and read_at is null
     returning 1
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: broadcast a notification to every active user, or a subset.
-- ---------------------------------------------------------------------
create or replace function public.admin_broadcast_notification(
  p_title text,
  p_message text,
  p_type notification_type default 'system',
  p_link text default null,
  p_user_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with inserted as (
    insert into public.notifications (user_id, type, title, message, link, created_by)
    select p.id, p_type, p_title, p_message, p_link, auth.uid()
      from public.profiles p
     where (p_user_ids is null and p.account_status = 'active')
        or (p_user_ids is not null and p.id = any (p_user_ids))
    returning 1
  )
  select count(*) into v_count from inserted;

  insert into public.audit_logs (actor_id, actor_email, action, entity_type, description, metadata)
  select auth.uid(), (select email from public.profiles where id = auth.uid()),
         'notification.broadcast', 'notification',
         format('Broadcast "%s" to %s recipient(s)', p_title, v_count),
         jsonb_build_object('recipients', v_count, 'type', p_type);

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin write helpers — every mutation is audited in the same transaction.
-- ---------------------------------------------------------------------
create or replace function public.admin_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_description text,
  p_metadata jsonb default null
)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_logs;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, description, metadata)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()),
          p_action, p_entity_type, p_entity_id, p_description, p_metadata)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_status account_status,
  p_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_MODIFY_SELF' using errcode = 'P0001';
  end if;

  update public.profiles
     set account_status = p_status,
         suspended_at = case when p_status = 'suspended' then now() else null end,
         suspension_reason = case when p_status = 'suspended' then p_reason else null end
   where id = p_user_id
   returning * into v_profile;

  if v_profile.id is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.admin_log(
    'user.status_changed', 'profile', p_user_id,
    format('Admin set account status to %s for %s', p_status, v_profile.email),
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  insert into public.notifications (user_id, type, title, message, created_by)
  values (
    p_user_id, 'security_alert', 'Account status updated',
    format('Your account status is now "%s".%s', p_status,
           case when p_reason is null then '' else ' Reason: ' || p_reason end),
    auth.uid()
  );

  return v_profile;
end;
$$;

create or replace function public.admin_update_user_role(
  p_user_id uuid,
  p_role user_role
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  -- Only a super admin may mint or revoke administrative access.
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_MODIFY_SELF' using errcode = 'P0001';
  end if;

  update public.profiles set role = p_role where id = p_user_id returning * into v_profile;
  if v_profile.id is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.admin_log(
    'user.role_changed', 'profile', p_user_id,
    format('Admin set role to %s for %s', p_role, v_profile.email),
    jsonb_build_object('role', p_role)
  );

  return v_profile;
end;
$$;

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status order_status,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.orders
     set status = p_status,
         rejection_reason = case when p_status = 'rejected' then p_reason else rejection_reason end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
   where id = p_order_id
   returning * into v_order;

  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.admin_log(
    'order.status_changed', 'order', p_order_id,
    format('Admin set order %s status to %s', v_order.reference, p_status),
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  insert into public.notifications (user_id, type, title, message, link, created_by)
  values (v_order.user_id, 'order_update', 'Order updated',
          format('Order %s is now %s.', v_order.reference, replace(p_status::text, '_', ' ')),
          '/orders', auth.uid());

  return v_order;
end;
$$;

create or replace function public.admin_update_car_order(
  p_car_order_id uuid,
  p_status car_order_status default null,
  p_estimated_delivery date default null,
  p_internal_notes text default null
)
returns public.car_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.car_orders;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.car_orders
     set status = coalesce(p_status, status),
         estimated_delivery = coalesce(p_estimated_delivery, estimated_delivery),
         internal_notes = coalesce(p_internal_notes, internal_notes)
   where id = p_car_order_id
   returning * into v_order;

  if v_order.id is null then
    raise exception 'CAR_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.admin_log(
    'car_order.updated', 'car_order', p_car_order_id,
    format('Admin updated vehicle order %s', v_order.reference),
    jsonb_build_object('status', p_status, 'estimated_delivery', p_estimated_delivery)
  );

  if p_status is not null then
    insert into public.notifications (user_id, type, title, message, link, created_by)
    values (v_order.user_id, 'car_order_update', 'Vehicle order updated',
            format('Order %s is now %s.', v_order.reference, replace(p_status::text, '_', ' ')),
            '/car-orders', auth.uid());
  end if;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Portfolio valuation — computed in the database from live holdings.
-- ---------------------------------------------------------------------
create or replace function public.portfolio_summary(p_user_id uuid default null)
returns table (
  holdings_value numeric,
  cost_basis numeric,
  cash_balance numeric,
  pending_balance numeric,
  reserved_balance numeric,
  invested_value numeric,
  invested_principal numeric,
  previous_close_value numeric,
  realized_pnl numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select case
      when p_user_id is null then auth.uid()
      when p_user_id = auth.uid() then auth.uid()
      when public.is_admin() then p_user_id
      else null
    end as user_id
  ),
  h as (
    select
      coalesce(sum(ph.quantity * mq.price), 0) as holdings_value,
      coalesce(sum(ph.quantity * ph.average_cost), 0) as cost_basis,
      coalesce(sum(ph.quantity * mq.previous_close), 0) as previous_close_value,
      coalesce(sum(ph.realized_pnl), 0) as realized_pnl
    from public.portfolio_holdings ph
    join public.market_quotes mq on mq.asset_id = ph.asset_id
    where ph.user_id = (select user_id from target) and ph.quantity > 0
  ),
  w as (
    select
      coalesce(sum(available_balance), 0) as cash_balance,
      coalesce(sum(pending_balance), 0) as pending_balance,
      coalesce(sum(reserved_balance), 0) as reserved_balance
    from public.wallets
    where user_id = (select user_id from target)
  ),
  i as (
    select
      coalesce(sum(current_value), 0) as invested_value,
      coalesce(sum(principal), 0) as invested_principal
    from public.investment_positions
    where user_id = (select user_id from target) and status = 'active'
  )
  select h.holdings_value, h.cost_basis, w.cash_balance, w.pending_balance, w.reserved_balance,
         i.invested_value, i.invested_principal, h.previous_close_value, h.realized_pnl
  from h, w, i
  where (select user_id from target) is not null;
$$;

-- ---------------------------------------------------------------------
-- Grants: RPCs are callable by authenticated sessions; RLS + the internal
-- authorisation checks above still govern what each call may do.
-- ---------------------------------------------------------------------
revoke all on function public.place_order(uuid, order_side, order_type, numeric, numeric, numeric, time_in_force) from public;
revoke all on function public.cancel_order(uuid) from public;
revoke all on function public.create_investment_position(uuid, numeric) from public;
revoke all on function public.create_car_order(uuid, jsonb, text, numeric, jsonb) from public;
revoke all on function public.demo_cash_movement(transaction_type, numeric, text) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.admin_broadcast_notification(text, text, notification_type, text, uuid[]) from public;
revoke all on function public.admin_log(text, text, uuid, text, jsonb) from public;
revoke all on function public.admin_update_user_status(uuid, account_status, text) from public;
revoke all on function public.admin_update_user_role(uuid, user_role) from public;
revoke all on function public.admin_update_order_status(uuid, order_status, text) from public;
revoke all on function public.admin_update_car_order(uuid, car_order_status, date, text) from public;
revoke all on function public.portfolio_summary(uuid) from public;

grant execute on function public.place_order(uuid, order_side, order_type, numeric, numeric, numeric, time_in_force) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.create_investment_position(uuid, numeric) to authenticated;
grant execute on function public.create_car_order(uuid, jsonb, text, numeric, jsonb) to authenticated;
grant execute on function public.demo_cash_movement(transaction_type, numeric, text) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.admin_broadcast_notification(text, text, notification_type, text, uuid[]) to authenticated;
grant execute on function public.admin_log(text, text, uuid, text, jsonb) to authenticated;
grant execute on function public.admin_update_user_status(uuid, account_status, text) to authenticated;
grant execute on function public.admin_update_user_role(uuid, user_role) to authenticated;
grant execute on function public.admin_update_order_status(uuid, order_status, text) to authenticated;
grant execute on function public.admin_update_car_order(uuid, car_order_status, date, text) to authenticated;
grant execute on function public.portfolio_summary(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;


-- ---------------------------------------------------------------------
-- 0003_rls.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — Row Level Security
-- =====================================================================
-- Principles:
--   * Deny by default: RLS is enabled on every table, including reference data.
--   * A user may only ever see rows keyed to their own auth.uid().
--   * Money-moving columns are never writable through the table API — those
--     paths go exclusively through the SECURITY DEFINER RPCs in 0002.
--   * Admin reach is granted through public.is_admin(), a SECURITY DEFINER
--     helper, so policies never recurse back into `profiles`.
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.user_settings          enable row level security;
alter table public.wallets                enable row level security;
alter table public.assets                 enable row level security;
alter table public.market_quotes          enable row level security;
alter table public.market_candles         enable row level security;
alter table public.portfolios             enable row level security;
alter table public.portfolio_holdings     enable row level security;
alter table public.portfolio_snapshots    enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_fills            enable row level security;
alter table public.investments            enable row level security;
alter table public.investment_positions   enable row level security;
alter table public.vehicles               enable row level security;
alter table public.vehicle_options        enable row level security;
alter table public.car_orders             enable row level security;
alter table public.transactions           enable row level security;
alter table public.watchlists             enable row level security;
alter table public.watchlist_items        enable row level security;
alter table public.notifications          enable row level security;
alter table public.support_tickets        enable row level security;
alter table public.support_messages       enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.login_events           enable row level security;
alter table public.system_settings        enable row level security;

-- Force RLS for table owners too, so a mistakenly-owner-scoped connection
-- cannot bypass the policies below.
alter table public.profiles              force row level security;
alter table public.wallets                force row level security;
alter table public.portfolio_holdings     force row level security;
alter table public.orders                 force row level security;
alter table public.transactions           force row level security;
alter table public.investment_positions   force row level security;
alter table public.car_orders             force row level security;
alter table public.notifications          force row level security;
alter table public.audit_logs             force row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admin updates flow through admin_update_user_* RPCs (audited); no broad
-- admin UPDATE policy is granted here on purpose.

-- Privilege escalation guard: a user may not change their own role or status.
create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'ROLE_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  if new.account_status is distinct from old.account_status then
    raise exception 'STATUS_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  if new.kyc_status is distinct from old.kyc_status then
    raise exception 'KYC_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_self_update on public.profiles;
create trigger profiles_guard_self_update before update on public.profiles
  for each row execute function public.guard_profile_self_update();

-- ---------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------
drop policy if exists user_settings_select on public.user_settings;
create policy user_settings_select on public.user_settings
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_settings_insert on public.user_settings;
create policy user_settings_insert on public.user_settings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_settings_update on public.user_settings;
create policy user_settings_update on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- wallets — read-only through the table API; balances change via RPC only.
-- ---------------------------------------------------------------------
drop policy if exists wallets_select on public.wallets;
create policy wallets_select on public.wallets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Reference data — readable by anyone (including signed-out visitors on the
-- public marketing pages); writable only by admins.
-- ---------------------------------------------------------------------
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select to anon, authenticated using (true);
drop policy if exists assets_admin_write on public.assets;
create policy assets_admin_write on public.assets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists market_quotes_select on public.market_quotes;
create policy market_quotes_select on public.market_quotes for select to anon, authenticated using (true);
drop policy if exists market_quotes_admin_write on public.market_quotes;
create policy market_quotes_admin_write on public.market_quotes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists market_candles_select on public.market_candles;
create policy market_candles_select on public.market_candles for select to anon, authenticated using (true);
drop policy if exists market_candles_admin_write on public.market_candles;
create policy market_candles_admin_write on public.market_candles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select to anon, authenticated using (true);
drop policy if exists vehicles_admin_write on public.vehicles;
create policy vehicles_admin_write on public.vehicles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists vehicle_options_select on public.vehicle_options;
create policy vehicle_options_select on public.vehicle_options for select to anon, authenticated using (true);
drop policy if exists vehicle_options_admin_write on public.vehicle_options;
create policy vehicle_options_admin_write on public.vehicle_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Investment products: the public may browse open products; admins see all.
drop policy if exists investments_select on public.investments;
create policy investments_select on public.investments
  for select to anon, authenticated
  using (status in ('open', 'paused', 'closed') or public.is_admin());

drop policy if exists investments_admin_write on public.investments;
create policy investments_admin_write on public.investments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Portfolios & holdings — read-only to users; mutated by place_order().
-- ---------------------------------------------------------------------
drop policy if exists portfolios_select on public.portfolios;
create policy portfolios_select on public.portfolios
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists portfolio_holdings_select on public.portfolio_holdings;
create policy portfolio_holdings_select on public.portfolio_holdings
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists portfolio_snapshots_select on public.portfolio_snapshots;
create policy portfolio_snapshots_select on public.portfolio_snapshots
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Orders — created and cancelled through RPCs; readable by their owner.
-- ---------------------------------------------------------------------
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists order_fills_select on public.order_fills;
create policy order_fills_select on public.order_fills
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Investment positions
-- ---------------------------------------------------------------------
drop policy if exists investment_positions_select on public.investment_positions;
create policy investment_positions_select on public.investment_positions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Car orders — users create through the RPC and may cancel their own request.
-- ---------------------------------------------------------------------
drop policy if exists car_orders_select on public.car_orders;
create policy car_orders_select on public.car_orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists car_orders_cancel_own on public.car_orders;
create policy car_orders_cancel_own on public.car_orders
  for update to authenticated
  using (user_id = auth.uid() and status in ('configuration', 'order_request', 'processing'))
  with check (user_id = auth.uid() and status = 'cancelled');

-- Internal notes must never be exposed to, or written by, the customer.
create or replace function public.guard_car_order_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.internal_notes is distinct from old.internal_notes
     or new.total_price is distinct from old.total_price
     or new.estimated_delivery is distinct from old.estimated_delivery
     or new.vehicle_id is distinct from old.vehicle_id
     or new.user_id is distinct from old.user_id then
    raise exception 'FIELD_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists car_orders_guard_user_update on public.car_orders;
create trigger car_orders_guard_user_update before update on public.car_orders
  for each row execute function public.guard_car_order_user_update();

-- ---------------------------------------------------------------------
-- Transactions — ledger rows are append-only via RPC; users read their own.
-- ---------------------------------------------------------------------
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Watchlists — fully user-managed.
-- ---------------------------------------------------------------------
drop policy if exists watchlists_all on public.watchlists;
create policy watchlists_all on public.watchlists
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

drop policy if exists watchlist_items_all on public.watchlist_items;
create policy watchlist_items_all on public.watchlist_items
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Notifications — users read and mark their own as read.
-- ---------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- A user may only flip read_at; the body of a notification is immutable.
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.title is distinct from old.title
     or new.message is distinct from old.message
     or new.type is distinct from old.type
     or new.link is distinct from old.link
     or new.user_id is distinct from old.user_id then
    raise exception 'FIELD_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_update on public.notifications;
create trigger notifications_guard_update before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ---------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------
drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists support_tickets_admin_update on public.support_tickets;
create policy support_tickets_admin_update on public.support_tickets
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin()
      or (
        is_staff = false
        and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------
-- Audit logs — admin-readable, and never editable from any client role.
-- Writes happen only through admin_log() / other SECURITY DEFINER functions.
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated using (public.is_admin());

create or replace function public.guard_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE' using errcode = '42501';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.guard_audit_log_immutable();

-- ---------------------------------------------------------------------
-- Login events
-- ---------------------------------------------------------------------
drop policy if exists login_events_select on public.login_events;
create policy login_events_select on public.login_events
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists login_events_insert_own on public.login_events;
create policy login_events_insert_own on public.login_events
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- System settings
-- ---------------------------------------------------------------------
drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select to anon, authenticated using (true);

drop policy if exists system_settings_admin_write on public.system_settings;
create policy system_settings_admin_write on public.system_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Realtime publication — only the tables the client genuinely subscribes to.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.market_quotes; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.wallets; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.portfolio_holdings; exception when duplicate_object then null; end;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 0004_seed_reference_data.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — reference & demo catalogue data
-- =====================================================================
-- This migration seeds only non-personal catalogue data: the tradable
-- instrument, the vehicle catalogue, investment products and platform
-- settings. No user accounts and no personal data are created here.
-- =====================================================================

insert into public.system_settings (key, value, description) values
  ('demo_mode', '{"enabled": true}'::jsonb,
   'When enabled, prices, balances, orders and vehicle order requests are simulated. Demo cash movement RPCs refuse to run when this is disabled.'),
  ('market_data', '{"provider": "simulated", "delayed": true, "disclaimer": "Prices are simulated and are not real-time market prices."}'::jsonb,
   'Active market-data provider descriptor surfaced in the UI.'),
  ('trading', '{"sell_fee_rate": 0.0000278, "commission_rate": 0, "flat_fee": 0}'::jsonb,
   'Fee schedule mirrored by src/lib/config.ts and place_order().'),
  ('platform', '{"registrations_open": true, "maintenance_mode": false}'::jsonb,
   'Platform-wide switches.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Tradable instrument
-- ---------------------------------------------------------------------
insert into public.assets (symbol, name, exchange, asset_class, currency, sector, description, is_tradable)
values (
  'TSLA', 'Tesla, Inc.', 'NASDAQ', 'equity', 'USD', 'Consumer Discretionary',
  'Tesla, Inc. designs, develops, manufactures and sells electric vehicles and energy generation and storage systems. BrokerT is an independent platform and is not affiliated with Tesla, Inc.',
  true
)
on conflict (symbol) do nothing;

-- A simulated opening quote. The demo market engine advances this over time.
insert into public.market_quotes (
  asset_id, price, previous_close, open_price, day_high, day_low,
  volume, market_cap, week52_high, week52_low, source, is_simulated
)
select a.id, 248.50, 244.10, 245.30, 251.80, 243.90,
       92_400_000, 792_000_000_000, 299.29, 138.80, 'simulated', true
from public.assets a
where a.symbol = 'TSLA'
on conflict (asset_id) do nothing;

-- ---------------------------------------------------------------------
-- Simulated daily history (5 years) — a seeded random walk so that every
-- deployment renders the same chart and the data is reproducible.
-- ---------------------------------------------------------------------
do $$
declare
  v_asset_id uuid;
  v_day date;
  v_price numeric := 165.00;
  v_open numeric;
  v_close numeric;
  v_high numeric;
  v_low numeric;
  v_drift numeric;
  v_shock numeric;
  v_vol bigint;
  v_i int := 0;
begin
  select id into v_asset_id from public.assets where symbol = 'TSLA';
  if v_asset_id is null then return; end if;

  if exists (select 1 from public.market_candles where asset_id = v_asset_id and interval = '1d') then
    return;
  end if;

  perform setseed(0.4242);

  for v_day in
    select d::date
    from generate_series(current_date - interval '5 years', current_date, interval '1 day') d
    where extract(isodow from d) < 6
  loop
    v_i := v_i + 1;
    v_open := v_price;
    -- Mild upward drift with a fat-ish tailed daily shock.
    v_drift := 0.0004;
    v_shock := (random() - 0.5) * 0.055 + (case when random() < 0.02 then (random() - 0.5) * 0.12 else 0 end);
    v_close := greatest(round((v_open * (1 + v_drift + v_shock))::numeric, 2), 5.00);
    -- random() is double precision, and round(double precision, int) does not
    -- exist in Postgres — only round(numeric, int). Cast before rounding.
    v_high := round((greatest(v_open, v_close) * (1 + random() * 0.018))::numeric, 2);
    v_low := round((least(v_open, v_close) * (1 - random() * 0.018))::numeric, 2);
    v_vol := (55_000_000 + random() * 90_000_000)::bigint;

    insert into public.market_candles (asset_id, interval, bucket_start, open, high, low, close, volume, is_simulated)
    values (v_asset_id, '1d', v_day::timestamptz, v_open, v_high, v_low, v_close, v_vol, true)
    on conflict do nothing;

    v_price := v_close;
  end loop;

  -- Align the live quote with the end of the generated history.
  update public.market_quotes mq
     set price = c.close,
         previous_close = c.open,
         open_price = c.open,
         day_high = c.high,
         day_low = c.low,
         volume = c.volume,
         market_cap = round(c.close * 3_200_000_000, 2),
         week52_high = h.hi,
         week52_low = h.lo,
         quoted_at = now()
    from (
      select * from public.market_candles
       where asset_id = v_asset_id and interval = '1d'
       order by bucket_start desc limit 1
    ) c,
    (
      select max(high) as hi, min(low) as lo
        from public.market_candles
       where asset_id = v_asset_id and interval = '1d'
         and bucket_start >= now() - interval '1 year'
    ) h
   where mq.asset_id = v_asset_id;
end $$;

-- ---------------------------------------------------------------------
-- Investment products (illustrative, simulated — never guaranteed)
-- ---------------------------------------------------------------------
insert into public.investments (
  slug, name, category, summary, description, objective, risk_level, risk_disclosure, terms,
  target_return_pct, duration_months, minimum_amount, maximum_amount,
  management_fee_pct, performance_fee_pct, capacity_amount, status, is_simulated
) values
(
  'tsla-core-accumulation',
  'TSLA Core Accumulation',
  'Single stock',
  'A disciplined, schedule-based accumulation strategy focused exclusively on TSLA.',
  'This strategy allocates a fixed amount into TSLA on a recurring schedule, smoothing entry price across market cycles rather than attempting to time a single entry. Concentration in one issuer means the strategy carries the full idiosyncratic risk of that issuer.',
  'Build a long-horizon position in a single equity while reducing the impact of entry timing.',
  'aggressive',
  'This strategy is concentrated in a single equity. A decline in that issuer''s share price will be reflected in full. There is no diversification benefit and no downside protection. You may lose some or all of the amount allocated.',
  'Minimum holding period of 12 months. Allocations may be withdrawn at the prevailing simulated valuation. Fees are deducted from the position value.',
  14.00, 24, 500, 250000, 0.45, 0.00, 5000000, 'open', true
),
(
  'ev-supply-chain',
  'EV Supply Chain Basket',
  'Thematic basket',
  'Diversified exposure across battery materials, charging infrastructure and EV component suppliers.',
  'A basket strategy spanning the electric-vehicle value chain — lithium and cathode materials, power electronics, charging networks and drivetrain suppliers. Diversification across the chain is intended to reduce single-issuer risk relative to a concentrated position, but the basket remains exposed to the EV sector as a whole.',
  'Capture growth across the electric-vehicle value chain with less single-issuer concentration.',
  'growth',
  'Sector-concentrated strategies move with the fortunes of that sector. Commodity price swings, policy changes and demand shifts can each cause significant drawdowns. Diversification does not assure a profit or protect against loss.',
  'No minimum holding period. Rebalanced quarterly. Target return is an illustrative projection based on simulated historical performance and is not a promise of future results.',
  11.50, 18, 1000, 500000, 0.65, 10.00, 12000000, 'open', true
),
(
  'clean-energy-income',
  'Clean Energy Income',
  'Income',
  'Income-oriented exposure to established renewable generation and storage operators.',
  'Focused on cash-generative operators in renewable generation, grid storage and energy distribution. The strategy prioritises distribution stability over capital appreciation, which historically has meant lower volatility than growth-oriented energy strategies — though lower volatility is not low risk.',
  'Generate a steadier return profile from operating renewable-energy assets.',
  'moderate',
  'Income distributions are not guaranteed and may be reduced or suspended. Rising interest rates typically pressure the valuation of income-oriented assets. Capital is at risk.',
  'Distributions are illustrative and simulated in demo mode. Minimum 6-month term. Early withdrawal is permitted at the prevailing simulated valuation.',
  7.25, 12, 250, 200000, 0.55, 0.00, 8000000, 'open', true
),
(
  'autonomy-and-ai',
  'Autonomy & AI Frontier',
  'Thematic basket',
  'High-conviction exposure to autonomous driving, robotics and applied AI compute.',
  'A concentrated, high-conviction basket across autonomous-driving software, robotics platforms and the compute layer underneath them. This is the highest-volatility strategy on the platform and is intended only for investors who can tolerate large drawdowns.',
  'Seek long-horizon capital growth from early-stage technology adoption curves.',
  'aggressive',
  'This strategy invests in companies whose valuations depend on technology adoption that may not materialise on the expected timeline, or at all. Drawdowns exceeding 50% have occurred historically in comparable strategies. Only allocate capital you can afford to lose entirely.',
  'Minimum 24-month horizon strongly recommended. Performance fee applies above the target return. All figures shown are simulated.',
  18.00, 36, 2500, 1000000, 0.85, 15.00, 6000000, 'open', true
),
(
  'balanced-mobility',
  'Balanced Mobility Portfolio',
  'Multi-asset',
  'A blended allocation across mobility equities, short-duration credit and cash.',
  'A multi-asset allocation that pairs mobility-sector equities with short-duration credit and a cash buffer. The credit and cash sleeves are intended to dampen equity drawdowns and to fund rebalancing into weakness.',
  'Provide diversified participation in the mobility transition with a moderated risk profile.',
  'balanced',
  'Multi-asset diversification reduces but does not eliminate risk. In periods of correlated selling, equity and credit sleeves may decline together. Capital is at risk.',
  'No lock-up. Rebalanced monthly. Target return is illustrative and reflects simulated performance only.',
  9.00, 12, 500, 300000, 0.50, 0.00, 15000000, 'open', true
),
(
  'gigafactory-infrastructure',
  'Gigafactory Infrastructure',
  'Real assets',
  'Long-duration exposure to industrial property and equipment serving EV manufacturing.',
  'Long-duration exposure to the industrial real assets underpinning EV manufacturing: plant, logistics property and specialised equipment leased to manufacturers. Returns are driven by lease income and terminal asset value rather than by equity markets.',
  'Access an income and terminal-value return profile that is less correlated with listed equities.',
  'moderate',
  'Real-asset strategies are illiquid. Capital may be committed for the full term with no ability to exit early. Tenant default, obsolescence and property-value declines can each impair returns.',
  'Committed capital is locked for the full 48-month term in this illustrative structure. Valuations are simulated and are updated periodically.',
  8.50, 48, 5000, null, 0.75, 8.00, 20000000, 'open', true
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Vehicle catalogue (independent demo marketplace — not Tesla inventory)
-- ---------------------------------------------------------------------
insert into public.vehicles (
  slug, model_name, tagline, description, base_price, range_miles, top_speed_mph,
  acceleration_0_60, drive_type, seating, features, is_available, display_order
) values
(
  'model-3', 'Model 3', 'The everyday electric sedan',
  'A compact executive sedan with a minimalist interior, long range and rapid charging. Configurations shown are illustrative specifications for this independent demo marketplace.',
  38990, 363, 125, 4.9, 'Rear-Wheel Drive', 5,
  array['15-inch centre touchscreen','Over-the-air software updates','Heat-pump climate system','Glass roof','Wireless phone charging','Driver assistance suite'],
  true, 1
),
(
  'model-y', 'Model Y', 'The versatile electric crossover',
  'A mid-size crossover pairing sedan efficiency with SUV cargo volume and an optional third row. Configurations shown are illustrative specifications for this independent demo marketplace.',
  44990, 337, 135, 4.8, 'All-Wheel Drive', 5,
  array['Panoramic glass roof','Power liftgate','Folding second row','Heated seats front and rear','Over-the-air software updates','Driver assistance suite'],
  true, 2
),
(
  'model-s', 'Model S', 'The long-range flagship sedan',
  'A full-size flagship sedan built for long-distance travel, with the highest range in the range and a performance-oriented drivetrain. Configurations shown are illustrative.',
  74990, 405, 149, 3.1, 'Dual Motor All-Wheel Drive', 5,
  array['17-inch cinematic display','Adaptive air suspension','Ventilated front seats','Premium 22-speaker audio','Rear touchscreen','Driver assistance suite'],
  true, 3
),
(
  'model-x', 'Model X', 'The seven-seat electric SUV',
  'A full-size SUV with falcon-wing rear doors, up to seven seats and towing capability. Configurations shown are illustrative.',
  79990, 348, 149, 3.8, 'Dual Motor All-Wheel Drive', 7,
  array['Falcon-wing doors','Up to seven seats','Adaptive air suspension','5,000 lb towing capacity','Premium audio','Driver assistance suite'],
  true, 4
),
(
  'cybertruck', 'Cybertruck', 'The stainless-steel electric pickup',
  'A body-on-exoskeleton pickup with a stainless-steel exterior, adaptive suspension and an onboard power system. Configurations shown are illustrative.',
  79990, 325, 112, 4.1, 'Dual Motor All-Wheel Drive', 5,
  array['Stainless-steel exoskeleton','Adaptive air suspension','11,000 lb towing capacity','Onboard power outlets','Powered tonneau cover','Driver assistance suite'],
  true, 5
)
on conflict (slug) do nothing;

-- Trims, paint, interiors, wheels and options for every vehicle.
do $$
declare
  v record;
begin
  for v in select id, slug, base_price from public.vehicles loop
    -- Trims
    insert into public.vehicle_options (vehicle_id, kind, code, name, description, price_delta, range_delta_miles, is_default, display_order)
    values
      (v.id, 'trim', 'standard', 'Standard Range', 'Balanced range and efficiency for daily driving.', 0, 0, true, 1),
      (v.id, 'trim', 'long-range', 'Long Range', 'Larger pack and dual motors for extended touring range.', 8000, 45, false, 2),
      (v.id, 'trim', 'performance', 'Performance', 'Uprated drive units, brakes and suspension tuning.', 14000, -18, false, 3)
    on conflict do nothing;

    -- Exterior paint
    insert into public.vehicle_options (vehicle_id, kind, code, name, description, price_delta, swatch, is_default, display_order)
    values
      (v.id, 'exterior', 'stealth-grey', 'Stealth Grey', null, 0, '#4a4d52', true, 1),
      (v.id, 'exterior', 'pearl-white', 'Pearl White', null, 1000, '#f2f2f0', false, 2),
      (v.id, 'exterior', 'deep-blue', 'Deep Blue Metallic', null, 1500, '#1f3a68', false, 3),
      (v.id, 'exterior', 'solid-black', 'Solid Black', null, 1500, '#101114', false, 4),
      (v.id, 'exterior', 'ultra-red', 'Ultra Red', null, 2000, '#8f1420', false, 5)
    on conflict do nothing;

    -- Interior
    insert into public.vehicle_options (vehicle_id, kind, code, name, description, price_delta, swatch, is_default, display_order)
    values
      (v.id, 'interior', 'all-black', 'All Black', null, 0, '#17181b', true, 1),
      (v.id, 'interior', 'black-white', 'Black and White', null, 1000, '#d9d9d6', false, 2),
      (v.id, 'interior', 'cream', 'Cream', null, 1500, '#e6dcc8', false, 3)
    on conflict do nothing;

    -- Wheels
    insert into public.vehicle_options (vehicle_id, kind, code, name, description, price_delta, range_delta_miles, is_default, display_order)
    values
      (v.id, 'wheels', 'aero-18', '18" Aero', 'Maximum range, aerodynamic covers.', 0, 0, true, 1),
      (v.id, 'wheels', 'sport-19', '19" Sport', 'Sharper turn-in, modest range trade-off.', 1500, -12, false, 2),
      (v.id, 'wheels', 'performance-20', '20" Performance', 'Widest contact patch, largest range trade-off.', 2500, -22, false, 3)
    on conflict do nothing;

    -- Additional options
    insert into public.vehicle_options (vehicle_id, kind, code, name, description, price_delta, is_default, display_order)
    values
      (v.id, 'option', 'tow-hitch', 'Tow Hitch', 'Factory-fitted tow bar and wiring.', 1200, false, 1),
      (v.id, 'option', 'premium-audio', 'Premium Audio', 'Upgraded amplifier and additional speakers.', 1800, false, 2),
      (v.id, 'option', 'winter-package', 'Winter Package', 'Heated wipers, washer nozzles and rear seats.', 900, false, 3),
      (v.id, 'option', 'enhanced-autopilot', 'Enhanced Driver Assistance', 'Navigate-on-route, auto lane change and parking assistance.', 6000, false, 4),
      (v.id, 'option', 'home-charger', 'Home Wall Charger', 'Wall connector with installation credit.', 550, false, 5)
    on conflict do nothing;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 0005_resting_orders.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — resting order execution
-- =====================================================================
-- place_order() fills marketable orders immediately and leaves the rest
-- resting. Without this, a limit or stop order would never fill even once the
-- market reached its price. This function re-evaluates resting orders against
-- the current quote and settles the ones that have become marketable, using
-- exactly the same accounting as an immediate fill.
--
-- It is invoked by the market layer after a tick is persisted, so the demo
-- venue behaves like a venue rather than a queue that never clears.
-- =====================================================================

create or replace function public.process_resting_orders(p_asset_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_asset public.assets;
  v_quote public.market_quotes;
  v_wallet public.wallets;
  v_holding public.portfolio_holdings;
  v_portfolio_id uuid;
  v_price numeric(20,4);
  v_notional numeric(20,2);
  v_fees numeric(20,2);
  v_total numeric(20,2);
  v_reserved numeric(20,2);
  v_balance_after numeric(20,2);
  v_new_qty numeric(20,8);
  v_new_avg numeric(20,8);
  v_realized numeric(20,2);
  v_marketable boolean;
  v_filled integer := 0;
  v_sell_fee_rate constant numeric := 0.0000278;
begin
  for v_order in
    select *
      from public.orders
     where status in ('submitted', 'partially_filled')
       and (p_asset_id is null or asset_id = p_asset_id)
       and order_type <> 'market'
     order by created_at
     for update skip locked
  loop
    select * into v_asset from public.assets where id = v_order.asset_id;
    select * into v_quote from public.market_quotes where asset_id = v_order.asset_id;
    continue when v_asset.id is null or v_quote.id is null;

    v_marketable := case v_order.order_type
      when 'limit' then (v_order.side = 'buy' and v_quote.price <= v_order.limit_price)
                     or (v_order.side = 'sell' and v_quote.price >= v_order.limit_price)
      when 'stop' then (v_order.side = 'buy' and v_quote.price >= v_order.stop_price)
                    or (v_order.side = 'sell' and v_quote.price <= v_order.stop_price)
      when 'stop_limit' then (
          (v_order.side = 'buy' and v_quote.price >= v_order.stop_price and v_quote.price <= v_order.limit_price)
       or (v_order.side = 'sell' and v_quote.price <= v_order.stop_price and v_quote.price >= v_order.limit_price)
      )
      else false
    end;

    continue when not coalesce(v_marketable, false);

    -- Fill at the quote, bounded by the customer's limit so they never do
    -- worse than the price they asked for.
    v_price := v_quote.price;
    if v_order.order_type in ('limit', 'stop_limit') then
      if v_order.side = 'buy' then
        v_price := least(v_quote.price, v_order.limit_price);
      else
        v_price := greatest(v_quote.price, v_order.limit_price);
      end if;
    end if;

    v_notional := round(v_order.quantity * v_price, 2);
    v_fees := case when v_order.side = 'sell' then round(v_notional * v_sell_fee_rate, 2) else 0 end;
    v_total := case when v_order.side = 'buy' then v_notional + v_fees else v_notional - v_fees end;

    select * into v_wallet
      from public.wallets
     where user_id = v_order.user_id and currency = v_asset.currency
       for update;
    continue when v_wallet.id is null;

    select id into v_portfolio_id
      from public.portfolios
     where user_id = v_order.user_id
     order by created_at limit 1;
    continue when v_portfolio_id is null;

    select * into v_holding
      from public.portfolio_holdings
     where portfolio_id = v_portfolio_id and asset_id = v_order.asset_id
       for update;

    if v_order.side = 'buy' then
      -- Buying power was reserved when the order was placed; release it and
      -- settle against the actual fill value.
      v_reserved := round(v_order.quantity * coalesce(v_order.limit_price, v_order.estimated_price, v_price), 2);
      v_reserved := least(v_reserved, v_wallet.reserved_balance);

      -- The fill can never cost more than what was reserved, because the fill
      -- price is capped at the limit. Any difference returns to available cash.
      if v_reserved < v_total then
        -- Defensive: reject rather than overdraw if the reservation was short.
        update public.orders
           set status = 'rejected',
               rejection_reason = 'Reserved funds no longer cover this order',
               cancelled_at = now()
         where id = v_order.id;
        update public.wallets
           set reserved_balance = reserved_balance - v_reserved,
               available_balance = available_balance + v_reserved
         where id = v_wallet.id;
        continue;
      end if;

      v_balance_after := v_wallet.available_balance + (v_reserved - v_total);

      update public.wallets
         set reserved_balance = reserved_balance - v_reserved,
             available_balance = v_balance_after
       where id = v_wallet.id;

      if v_holding.id is null then
        insert into public.portfolio_holdings (portfolio_id, user_id, asset_id, quantity, average_cost)
        values (v_portfolio_id, v_order.user_id, v_order.asset_id, v_order.quantity, v_price);
      else
        v_new_qty := v_holding.quantity + v_order.quantity;
        v_new_avg := ((v_holding.quantity * v_holding.average_cost) + (v_order.quantity * v_price)) / v_new_qty;
        update public.portfolio_holdings
           set quantity = v_new_qty, average_cost = v_new_avg
         where id = v_holding.id;
      end if;
    else
      -- A sell can only fill if the position is still there; the customer may
      -- have sold it elsewhere since the order was placed.
      if coalesce(v_holding.quantity, 0) < v_order.quantity then
        update public.orders
           set status = 'rejected',
               rejection_reason = 'Position no longer sufficient to fill this order',
               cancelled_at = now()
         where id = v_order.id;

        insert into public.notifications (user_id, type, title, message, link)
        values (v_order.user_id, 'order_update', 'Order rejected',
                format('Order %s could not fill: the position is no longer sufficient.', v_order.reference),
                '/orders');
        continue;
      end if;

      v_balance_after := v_wallet.available_balance + v_total;
      update public.wallets set available_balance = v_balance_after where id = v_wallet.id;

      v_realized := round((v_price - v_holding.average_cost) * v_order.quantity, 2);
      v_new_qty := v_holding.quantity - v_order.quantity;

      update public.portfolio_holdings
         set quantity = v_new_qty,
             average_cost = case when v_new_qty = 0 then 0 else v_holding.average_cost end,
             realized_pnl = v_holding.realized_pnl + v_realized
       where id = v_holding.id;
    end if;

    insert into public.order_fills (order_id, user_id, quantity, price, fees)
    values (v_order.id, v_order.user_id, v_order.quantity, v_price, v_fees);

    update public.orders
       set status = 'filled',
           filled_quantity = v_order.quantity,
           average_fill_price = v_price,
           fees = v_fees,
           filled_at = now()
     where id = v_order.id;

    insert into public.transactions (
      reference, user_id, type, status, amount, currency, balance_after,
      description, related_order_id, is_simulated, processed_at
    ) values (
      public.generate_reference('TXN', 'public.transactions'),
      v_order.user_id,
      case when v_order.side = 'buy' then 'buy'::transaction_type else 'sell'::transaction_type end,
      'completed',
      case when v_order.side = 'buy' then -v_total else v_total end,
      v_asset.currency,
      v_balance_after,
      format('%s %s %s @ %s', initcap(v_order.side::text),
             trim(to_char(v_order.quantity, 'FM999999990.######')), v_asset.symbol,
             to_char(v_price, 'FM999999990.00')),
      v_order.id,
      v_quote.is_simulated,
      now()
    );

    if v_fees > 0 then
      insert into public.transactions (
        reference, user_id, type, status, amount, currency, balance_after,
        description, related_order_id, is_simulated, processed_at
      ) values (
        public.generate_reference('TXN', 'public.transactions'),
        v_order.user_id, 'fee', 'completed', -v_fees, v_asset.currency, v_balance_after,
        format('Regulatory fee on order %s', v_order.reference), v_order.id, v_quote.is_simulated, now()
      );
    end if;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      v_order.user_id, 'order_filled', 'Order filled',
      format('%s %s %s filled at %s (order %s).', initcap(v_order.side::text),
             trim(to_char(v_order.quantity, 'FM999999990.######')), v_asset.symbol,
             to_char(v_price, 'FM999999990.00'), v_order.reference),
      '/orders'
    );

    v_filled := v_filled + 1;
  end loop;

  return v_filled;
end;
$$;

-- Called by the trusted server-side market layer, never by a browser session.
revoke all on function public.process_resting_orders(uuid) from public;


-- ---------------------------------------------------------------------
-- 0006_guard_trusted_paths.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — let trusted server-side paths through the column guards
-- =====================================================================
-- The guard triggers on profiles, car_orders and notifications exist to stop a
-- *signed-in customer* changing columns they should not: their own role,
-- account status or verification state; a vehicle order's internal notes or
-- price; the body of a notification.
--
-- They exempted `public.is_admin()`, which is true for an administrator acting
-- through the SECURITY DEFINER admin functions (auth.uid() is still the
-- admin's id inside those). But they did not exempt a connection with no end
-- user at all — the service-role client used by the admin bootstrap script and
-- the /api/admin/setup endpoint. For those, auth.uid() is null, is_admin() is
-- false, and the trigger fired: promoting the very first administrator was
-- impossible.
--
-- Exempting a null auth.uid() is safe because Row Level Security has already
-- decided whether the row can be touched at all. `profiles_update_own` requires
-- `id = auth.uid()`, so an anonymous or unauthenticated request matches no rows
-- and never reaches the trigger. Only a connection that bypasses RLS — the
-- service role, a migration, or a maintenance session — arrives here with no
-- user, and those are trusted by definition.
--
-- Division of responsibility, stated plainly:
--   RLS      decides WHICH ROWS a caller may touch.
--   Triggers decide WHICH COLUMNS a signed-in caller may change on those rows.
-- =====================================================================

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No end-user session: a trusted server-side path. RLS has already gated
  -- row access, so there is nothing left for this guard to protect against.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'ROLE_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  if new.account_status is distinct from old.account_status then
    raise exception 'STATUS_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  if new.kyc_status is distinct from old.kyc_status then
    raise exception 'KYC_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.guard_car_order_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.internal_notes is distinct from old.internal_notes
     or new.total_price is distinct from old.total_price
     or new.estimated_delivery is distinct from old.estimated_delivery
     or new.vehicle_id is distinct from old.vehicle_id
     or new.user_id is distinct from old.user_id then
    raise exception 'FIELD_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.guard_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.message is distinct from old.message
     or new.type is distinct from old.type
     or new.link is distinct from old.link
     or new.user_id is distinct from old.user_id then
    raise exception 'FIELD_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- The audit log stays immutable for every role without exception, including
-- the service role. Nothing in the application ever needs to rewrite history.


-- ---------------------------------------------------------------------
-- 0007_grants.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — explicit table privileges
-- =====================================================================
-- A Supabase project pre-configures default privileges so that tables created
-- in `public` are granted to anon, authenticated and service_role. Relying on
-- that left an unstated dependency on the platform: applied to a plain
-- Postgres, or to a project whose default privileges had been tightened, every
-- query failed with "permission denied for table ...".
--
-- Granting these explicitly makes the schema self-sufficient and documents the
-- intent. It does not widen access: SQL privileges decide whether a role may
-- touch a table at all, and Row Level Security then decides which rows. Every
-- table here has RLS enabled, so a grant is necessary but never sufficient.
--
-- Note the tables with no INSERT/UPDATE policy — wallets, orders, order_fills,
-- transactions. They are granted here and still unwritable, because RLS admits
-- no write. Their rows are produced only by the SECURITY DEFINER functions.
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Reference data a signed-out visitor reads on the marketing pages.
grant select on
  public.assets,
  public.market_quotes,
  public.market_candles,
  public.vehicles,
  public.vehicle_options,
  public.investments,
  public.system_settings
to anon, authenticated;

-- Everything a signed-in customer touches. RLS narrows each of these to the
-- caller's own rows, and to the columns the guard triggers permit.
grant select, insert, update, delete on
  public.profiles,
  public.user_settings,
  public.watchlists,
  public.watchlist_items,
  public.notifications,
  public.support_tickets,
  public.support_messages,
  public.login_events,
  public.car_orders
to authenticated;

-- Read-only to the customer: these rows are written exclusively by the
-- transactional functions, never through the table API.
grant select on
  public.wallets,
  public.portfolios,
  public.portfolio_holdings,
  public.portfolio_snapshots,
  public.orders,
  public.order_fills,
  public.investment_positions,
  public.transactions,
  public.audit_logs
to authenticated;

-- Admins write catalogue data through the table API; RLS gates it on is_admin().
grant insert, update, delete on
  public.assets,
  public.market_quotes,
  public.market_candles,
  public.vehicles,
  public.vehicle_options,
  public.investments,
  public.system_settings
to authenticated;

-- The service role bypasses RLS and is used only by trusted server-side code.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Keep future tables consistent with the above without another migration.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;


-- ---------------------------------------------------------------------
-- 0008_ensure_profile.sql
-- ---------------------------------------------------------------------

-- =====================================================================
-- BrokerT — self-healing account provisioning
-- =====================================================================
-- handle_new_user() provisions a profile, settings, wallet, portfolio and
-- watchlist when an auth user is created. If that trigger was not yet
-- installed when someone signed up — the schema was applied partially, or the
-- account predates the trigger — the person ends up with a valid session and
-- no profile row.
--
-- The application treated that as "not signed in" and redirected to /login,
-- while the proxy saw a valid session on /login and redirected back to the
-- dashboard: an endless bounce with no way out and no explanation.
--
-- ensure_profile() repairs that state. It is idempotent, provisions exactly
-- what handle_new_user() would, and acts only on the caller's own account.
-- =====================================================================

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth auth.users;
  v_profile public.profiles;
  v_portfolio_id uuid;
  v_watchlist_id uuid;
  v_asset_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile.id is not null then
    return v_profile;
  end if;

  select * into v_auth from auth.users where id = v_user_id;
  if v_auth.id is null then
    raise exception 'AUTH_USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.profiles (id, email, first_name, last_name, phone, country, email_verified_at)
  values (
    v_auth.id,
    v_auth.email,
    nullif(v_auth.raw_user_meta_data ->> 'first_name', ''),
    nullif(v_auth.raw_user_meta_data ->> 'last_name', ''),
    nullif(v_auth.raw_user_meta_data ->> 'phone', ''),
    nullif(v_auth.raw_user_meta_data ->> 'country', ''),
    v_auth.email_confirmed_at
  )
  on conflict (id) do nothing
  returning * into v_profile;

  if v_profile.id is null then
    select * into v_profile from public.profiles where id = v_user_id;
  end if;

  insert into public.user_settings (user_id) values (v_user_id) on conflict do nothing;
  insert into public.wallets (user_id, currency) values (v_user_id, 'USD') on conflict do nothing;

  insert into public.portfolios (user_id, name) values (v_user_id, 'Main portfolio')
  on conflict (user_id, name) do nothing
  returning id into v_portfolio_id;

  insert into public.watchlists (user_id, name, is_default) values (v_user_id, 'My watchlist', true)
  on conflict (user_id, name) do nothing
  returning id into v_watchlist_id;

  select id into v_asset_id from public.assets where symbol = 'TSLA';
  if v_watchlist_id is not null and v_asset_id is not null then
    insert into public.watchlist_items (watchlist_id, user_id, asset_id)
    values (v_watchlist_id, v_user_id, v_asset_id)
    on conflict do nothing;
  end if;

  return v_profile;
end;
$$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;


-- =====================================================================
-- Verification
-- =====================================================================
do $$
declare
  v_tables int; v_policies int; v_candles int;
  v_investments int; v_vehicles int; v_options int; v_ensure int;
begin
  select count(*) into v_tables from pg_tables where schemaname = 'public';
  select count(*) into v_policies from pg_policies where schemaname = 'public';
  select count(*) into v_candles from public.market_candles;
  select count(*) into v_investments from public.investments;
  select count(*) into v_vehicles from public.vehicles;
  select count(*) into v_options from public.vehicle_options;
  select count(*) into v_ensure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('handle_new_user','ensure_profile','place_order');

  raise notice 'tables:      %  (expect 25)', v_tables;
  raise notice 'policies:    %  (expect 40+)', v_policies;
  raise notice 'candles:     %  (expect ~1300)', v_candles;
  raise notice 'strategies:  %  (expect 6)', v_investments;
  raise notice 'vehicles:    %  (expect 5)', v_vehicles;
  raise notice 'car options: %  (expect 95)', v_options;
  raise notice 'key funcs:   %  (expect 3)', v_ensure;

  if v_tables < 25 or v_policies < 40 or v_candles < 1000
     or v_investments < 6 or v_vehicles < 5 or v_ensure < 3 then
    raise exception 'Setup incomplete - see the counts above.';
  end if;

  raise notice '----------------------------------------------------';
  raise notice 'OK. Database ready. Register at /register next.';
end $$;
