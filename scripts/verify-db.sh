#!/usr/bin/env bash
# Run the migrations against a throwaway local Postgres.
#
# The SQL is the security model, so it must be executed, not just eyeballed.
# This spins up a temporary cluster, applies a minimal stand-in for the parts
# of Supabase the migrations touch (auth.users, auth.uid(), the roles), runs
# every migration, and exercises the money and authorisation paths.
#
# Requires the postgresql server binaries (Debian/Ubuntu: postgresql-16).
#   sudo apt-get install -y postgresql-16
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDIR=${PGDIR:-/tmp/brokert-verify}
PORT=${PORT:-5433}
export PATH="$PGBIN:$PATH"

command -v initdb >/dev/null || { echo "initdb not found. Set PGBIN or install postgresql-16."; exit 1; }

# Postgres refuses to run as root. When invoked as root (common in containers
# and CI images), drop to an unprivileged user and re-run this same script.
if [[ "$(id -u)" -eq 0 ]]; then
  RUNNER=${RUNNER:-brokert-verify}
  id -u "$RUNNER" >/dev/null 2>&1 || useradd -m "$RUNNER"
  rm -rf "$PGDIR"; mkdir -p "$PGDIR"; chown -R "$RUNNER" "$PGDIR"
  exec su "$RUNNER" -c "PGBIN='$PGBIN' PGDIR='$PGDIR' PORT='$PORT' bash '$(realpath "$0")'"
fi

cleanup() { pg_ctl -D "$PGDIR/data" stop -m immediate >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Starting a throwaway Postgres (unix socket in $PGDIR)"
rm -rf "$PGDIR"; mkdir -p "$PGDIR"
initdb -D "$PGDIR/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$PGDIR/data" -l "$PGDIR/log" \
  -o "-p $PORT -k $PGDIR -c listen_addresses=''" start >/dev/null
sleep 2

psql() { command psql -h "$PGDIR" -p "$PORT" -U postgres "$@"; }

createdb -h "$PGDIR" -p "$PORT" -U postgres brokert

echo "==> Applying the Supabase stand-in"
psql -d brokert -q -v ON_ERROR_STOP=1 <<'SQL' 2>/dev/null
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique, encrypted_password text,
  email_confirmed_at timestamptz, last_sign_in_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
SQL

echo "==> Running migrations"
for f in supabase/migrations/*.sql; do
  if psql -d brokert -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>"$PGDIR/err"; then
    echo "    ok   $(basename "$f")"
  else
    echo "    FAIL $(basename "$f")"; grep -m3 ERROR "$PGDIR/err" || true; exit 1
  fi
done

echo "==> Re-running them (idempotency)"
for f in supabase/migrations/*.sql; do
  psql -d brokert -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 \
    || { echo "    FAIL on re-run: $(basename "$f")"; exit 1; }
done
echo "    ok"

echo "==> Exercising the money and authorisation paths"
psql -d brokert -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id,email,raw_user_meta_data,email_confirmed_at) values
  ('11111111-1111-4111-8111-111111111111','a@test',
   '{"first_name":"A"}'::jsonb, now()),
  ('22222222-2222-4222-8222-222222222222','b@test',
   '{"first_name":"B"}'::jsonb, now());
update wallets set available_balance = 50000;
SQL

fail=0
# check <name> <acting-user> <sql> <expected...>
# Passes if the result contains ANY of the expected substrings. Several of
# these are blocked by two independent layers — SQL privileges and RLS — and
# either denial is a correct outcome.
check() {
  local name=$1 user=$2 sql=$3; shift 3
  local got expected
  got=$(psql -d brokert -tA <<SQL 2>&1 | tr '\n' ' '
begin; set local role authenticated; set local request.jwt.claim.sub = '$user';
$sql
commit;
SQL
)
  for expected in "$@"; do
    if [[ "$got" == *"$expected"* ]]; then printf "    ok   %s\n" "$name"; return; fi
  done
  printf "    FAIL %s -> %s\n" "$name" "$got"; fail=1
}

A=11111111-1111-4111-8111-111111111111
B=22222222-2222-4222-8222-222222222222

check "market buy fills"            "$A" "select status from place_order((select id from assets where symbol='TSLA'),'buy','market',10,null,null,'day');" "filled"
check "buy beyond cash rejected"    "$A" "select 1 from place_order((select id from assets where symbol='TSLA'),'buy','market',999999,null,null,'day');" "INSUFFICIENT_FUNDS"
check "oversized sell rejected"     "$A" "select 1 from place_order((select id from assets where symbol='TSLA'),'sell','market',999999,null,null,'day');" "INSUFFICIENT_POSITION"
check "RLS hides other users"       "$B" "select count(*) from orders;" "0"
check "self role change blocked"    "$A" "update profiles set role='super_admin' where id='$A';" "ROLE_CHANGE_FORBIDDEN"
check "direct wallet write blocked" "$A" "update wallets set available_balance=1e9 where user_id='$A';" "permission denied" "UPDATE 0"
check "fake ledger row blocked"     "$A" "insert into transactions(reference,user_id,type,amount) values('X','$A','deposit',1);" "permission denied" "violates row-level"
check "fake holding blocked"        "$A" "insert into portfolio_holdings(portfolio_id,user_id,asset_id,quantity,average_cost) select id,'$A',(select id from assets limit 1),1e6,1 from portfolios where user_id='$A';" "permission denied" "violates row-level"
check "audit log unreadable"        "$A" "select count(*) from audit_logs;" "0"
check "resting limit order rests"   "$A" "select status from place_order((select id from assets where symbol='TSLA'),'buy','limit',1,1.00,null,'gtc');" "submitted"
check "non-admin admin call denied" "$B" "select 1 from admin_update_user_status('$A','suspended',null);" "FORBIDDEN"

# The trusted server-side path (service role) must still be able to bootstrap.
if psql -d brokert -tAc "update profiles set role='super_admin' where id='$A';" >/dev/null 2>&1; then
  echo "    ok   service role can promote the first admin"
else
  echo "    FAIL service role cannot promote the first admin"; fail=1
fi

echo
if [[ $fail -eq 0 ]]; then echo "All database checks passed."; else echo "Some checks FAILED."; exit 1; fi
