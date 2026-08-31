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
