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
