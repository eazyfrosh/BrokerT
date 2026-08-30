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
