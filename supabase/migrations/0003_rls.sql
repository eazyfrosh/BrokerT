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
