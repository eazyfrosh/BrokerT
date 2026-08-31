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
