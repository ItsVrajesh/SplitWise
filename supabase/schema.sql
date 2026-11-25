-- Run once in the Supabase SQL editor. All money is stored as integer minor units.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  emoji text not null default '✦',
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  invite_code text not null unique default upper(encode(gen_random_bytes(8), 'hex')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id, group_id);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  category text not null default 'Other',
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  paid_by uuid not null references public.profiles(id),
  split_mode text not null check (split_mode in ('equal','exact','percent','shares')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id)
);
create index if not exists expenses_group_idx on public.expenses(group_id, created_at desc);
create table if not exists public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents >= 0),
  primary key (expense_id, user_id)
);
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  check (from_user <> to_user)
);
create index if not exists settlements_group_idx on public.settlements(group_id, created_at desc);

create or replace function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), nullif(split_part(new.email, '@', 1), ''), 'Friend'), 60));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create schema if not exists private;
create or replace function private.my_group_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select group_id from public.group_members where user_id = (select auth.uid())
$$;
revoke all on function private.my_group_ids() from public;
grant usage on schema private to authenticated;
grant execute on function private.my_group_ids() to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;

create policy "read shared profiles" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.group_members gm
    where gm.user_id = profiles.id and gm.group_id in (select private.my_group_ids())
  )
);
create policy "update own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "read own groups" on public.groups for select to authenticated
using (id in (select private.my_group_ids()));
create policy "read group members" on public.group_members for select to authenticated
using (group_id in (select private.my_group_ids()));
create policy "read group expenses" on public.expenses for select to authenticated
using (group_id in (select private.my_group_ids()));
create policy "read group shares" on public.expense_shares for select to authenticated
using (expense_id in (select id from public.expenses));
create policy "read group settlements" on public.settlements for select to authenticated
using (group_id in (select private.my_group_ids()));

-- Writes are only through validated, atomic RPC functions.
revoke all on public.profiles, public.groups, public.group_members, public.expenses, public.expense_shares, public.settlements from anon;
revoke insert, update, delete on public.groups, public.group_members, public.expenses, public.expense_shares, public.settlements from anon, authenticated;
grant select on public.profiles, public.groups, public.group_members, public.expenses, public.expense_shares, public.settlements to authenticated;
grant update(display_name) on public.profiles to authenticated;

create or replace function public.create_group(p_name text, p_emoji text default '✦', p_currency text default 'INR')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Group name must be 1–80 characters'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
  insert into public.groups(name, emoji, currency, created_by)
  values (trim(p_name), coalesce(nullif(p_emoji, ''), '✦'), p_currency, v_user) returning id into v_id;
  insert into public.group_members(group_id, user_id) values (v_id, v_user);
  return v_id;
end $$;

create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select id into v_id from public.groups where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'Invite code not found'; end if;
  insert into public.group_members(group_id, user_id) values (v_id, v_user) on conflict do nothing;
  return v_id;
end $$;

create or replace function public.add_expense(
  p_group_id uuid, p_title text, p_category text, p_amount_cents bigint,
  p_paid_by uuid, p_split_mode text, p_shares jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid(); v_count int; v_total bigint;
begin
  if v_user is null or not exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_user) then
    raise exception 'Not a group member';
  end if;
  if char_length(trim(p_title)) not between 1 and 120 or p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000000 then
    raise exception 'Invalid expense';
  end if;
  if p_split_mode not in ('equal','exact','percent','shares') then raise exception 'Invalid split mode'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_paid_by) then raise exception 'Payer is not a member'; end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then raise exception 'Add at least one participant'; end if;
  select count(*), coalesce(sum((x->>'cents')::bigint), 0) into v_count, v_total
  from jsonb_array_elements(p_shares) x;
  if v_total <> p_amount_cents or v_count <> (select count(distinct (x->>'userId')) from jsonb_array_elements(p_shares) x)
     or exists (select 1 from jsonb_array_elements(p_shares) x where (x->>'cents')::bigint < 0 or not exists
       (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = (x->>'userId')::uuid)) then
    raise exception 'Shares must be unique group members and add up to the total';
  end if;
  insert into public.expenses(group_id, title, category, amount_cents, paid_by, split_mode, created_by)
  values (p_group_id, trim(p_title), coalesce(nullif(trim(p_category), ''), 'Other'), p_amount_cents, p_paid_by, p_split_mode, v_user)
  returning id into v_id;
  insert into public.expense_shares(expense_id, user_id, amount_cents)
  select v_id, (x->>'userId')::uuid, (x->>'cents')::bigint from jsonb_array_elements(p_shares) x;
  return v_id;
end $$;

create or replace function public.record_settlement(p_group_id uuid, p_from uuid, p_to uuid, p_amount_cents bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null or not exists (select 1 from public.group_members where group_id = p_group_id and user_id = v_user) then
    raise exception 'Not a group member';
  end if;
  if p_from = p_to or p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Invalid settlement'; end if;
  if p_from <> v_user then raise exception 'You can only record payments you sent'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_from)
    or not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_to) then raise exception 'Both people must be members'; end if;
  insert into public.settlements(group_id, from_user, to_user, amount_cents, created_by)
  values (p_group_id, p_from, p_to, p_amount_cents, v_user) returning id into v_id;
  return v_id;
end $$;

create or replace function public.void_expense(p_expense_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.expenses set voided_at = now(), voided_by = auth.uid()
  where id = p_expense_id and created_by = auth.uid() and voided_at is null;
  if not found then raise exception 'Only the creator can remove an active expense'; end if;
end $$;

create or replace function public.void_settlement(p_settlement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.settlements set voided_at = now(), voided_by = auth.uid()
  where id = p_settlement_id and created_by = auth.uid() and voided_at is null;
  if not found then raise exception 'Only the creator can remove an active payment'; end if;
end $$;

revoke all on function public.create_group(text,text,text), public.join_group(text),
  public.add_expense(uuid,text,text,bigint,uuid,text,jsonb), public.record_settlement(uuid,uuid,uuid,bigint),
  public.void_expense(uuid), public.void_settlement(uuid) from public;
grant execute on function public.create_group(text,text,text), public.join_group(text),
  public.add_expense(uuid,text,text,bigint,uuid,text,jsonb), public.record_settlement(uuid,uuid,uuid,bigint),
  public.void_expense(uuid), public.void_settlement(uuid) to authenticated;
