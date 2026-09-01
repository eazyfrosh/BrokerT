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
