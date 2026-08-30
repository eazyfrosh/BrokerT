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
