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
