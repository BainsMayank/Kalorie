-- Kalorie — Stage 11c: groups and shared foods (SPEC §4.3).
--
-- A group is a few people (a family, friends) who share foods with each other:
--   · anyone signed in can start a group and gets a 6-character invite code;
--   · anyone with the code can join; everyone in a group is equal (no owner);
--   · a person is in at most one group at a time;
--   · leaving takes your shared foods and flags with you; the last person out ends the group.
-- Shared foods are copies of a person's own foods (recipes, products, custom foods), nutrients
-- per 100 g. Only the person who shared a food can change or remove it; anyone else in the group
-- can flag it as wrong.
--
-- Who can see what is decided by Row Level Security below: everything here is visible only to
-- the members of the group it belongs to. supabase/tests/rls.test.sql proves it.
--
-- Joining, leaving, starting a group and making a new code go through database functions
-- (security definer, like delete_my_account()): nobody can write to groups or group_members
-- directly, so the only way into a group is its invite code.

-- 0. custom_foods on the phone gained three columns (user.db migration 0008_group_sharing).
--    The mirror table gets them too, so a later backup (Stage 11b) can carry them.
alter table public.custom_foods add column share_with_group boolean not null default false;
alter table public.custom_foods add column shared_at bigint;
alter table public.custom_foods add column added_by text;

-- 1. A schema for helpers the app can't call through the API (Supabase only exposes `public`).
create schema private;
grant usage on schema private to authenticated;

-- 2. The tables.

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  -- 6 letters and digits, leaving out 0 O 1 I L, which are easy to mix up when read aloud.
  invite_code text not null unique check (invite_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The name the others see next to foods you share ("Asha").
  display_name text not null check (char_length(display_name) between 1 and 30),
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id),
  -- One group per person.
  unique (user_id)
);

create table public.shared_foods (
  -- The same id as the food on the sharer's phone (custom_foods.id), so it is easy to match.
  id               uuid primary key,
  group_id         uuid not null,
  created_by       uuid not null default auth.uid(),
  kind             text not null check (kind in ('custom', 'product', 'recipe')),
  name             text not null check (char_length(name) between 1 and 120),
  brand            text check (char_length(brand) <= 120),
  barcode          text check (barcode ~ '^[0-9]{8,14}$'),
  serving_g        double precision check (serving_g > 0),
  density_g_per_ml double precision not null default 1 check (density_g_per_ml > 0),
  cooked_with_fat  boolean not null default false,
  -- Per 100 g, keyed like custom_foods' nutrient columns ({"energy_kcal": 140, …}); null = unknown.
  nutrients        jsonb not null
                   check (jsonb_typeof(nutrients) = 'object' and pg_column_size(nutrients) < 8192),
  -- [{"unit": "serving", "label": "serving", "grams": 250, "is_default": true}, …]
  units            jsonb not null default '[]'
                   check (jsonb_typeof(units) = 'array' and jsonb_array_length(units) <= 20),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- The sharer must be in the group; when they leave (or delete their account) their shared
  -- foods go too.
  foreign key (group_id, created_by)
    references public.group_members (group_id, user_id) on delete cascade
);
create index shared_foods_group_idx on public.shared_foods (group_id);

create table public.shared_food_flags (
  shared_food_id uuid not null references public.shared_foods (id) on delete cascade,
  -- No link to auth.users: a person's flags are removed when they leave the group (step 4),
  -- which also happens when their account is deleted.
  user_id        uuid not null default auth.uid(),
  reason         text not null check (reason in ('kcal', 'nutrients', 'name', 'other')),
  note           text check (char_length(note) <= 200),
  created_at     timestamptz not null default now(),
  primary key (shared_food_id, user_id)
);

-- Wrong invite codes typed, so nobody can try codes one after another (step 5).
create table private.join_attempts (
  user_id  uuid not null references auth.users (id) on delete cascade,
  tried_at timestamptz not null default now()
);
create index join_attempts_user_idx on private.join_attempts (user_id, tried_at);

-- 3. Helpers.

-- The group the signed-in person is in, or null. Row Level Security below uses it; it reads
-- group_members with the owner's rights, so a policy on group_members can use it without
-- calling itself over and over.
create function private.my_group_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id from public.group_members where user_id = (select auth.uid())
$$;
revoke execute on function private.my_group_id() from public;
grant execute on function private.my_group_id() to authenticated;

-- A new random invite code: 6 characters from the 31 above, from gen_random_uuid()'s random bytes.
create function private.random_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', get_byte(bytes, i) % 31 + 1, 1), ''
                    order by i)
  from (select uuid_send(gen_random_uuid()) as bytes) as random, generate_series(0, 5) as i
$$;
revoke execute on function private.random_invite_code() from public;

-- A shared food's updated_at is the server's clock, and created_at never changes.
create function private.touch_shared_food()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger shared_foods_touch
  before update on public.shared_foods
  for each row execute function private.touch_shared_food();

-- 4. When someone leaves (or deletes their account): their flags on the group's foods go, and a
--    group with nobody left is deleted. Their shared foods go by the foreign key above.
create function private.after_member_leaves()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shared_food_flags as flag
    using public.shared_foods as food
    where flag.shared_food_id = food.id
      and food.group_id = old.group_id
      and flag.user_id = old.user_id;
  delete from public.groups as g
    where g.id = old.group_id
      and not exists (select 1 from public.group_members as m where m.group_id = old.group_id);
  return null;
end;
$$;
create trigger group_members_after_delete
  after delete on public.group_members
  for each row execute function private.after_member_leaves();

-- 5. What the app calls (supabase.rpc). Each one works only for the signed-in person.
--    Errors the app tells apart: KG001 already in a group · KG002 too many wrong codes ·
--    KG003 group is full · KG004 not in a group.

create function public.create_group(group_name text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text;
  new_group uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if exists (select 1 from public.group_members where user_id = me) then
    raise exception 'Already in a group' using errcode = 'KG001';
  end if;
  loop
    code := private.random_invite_code();
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups (name, invite_code) values (btrim(group_name), code)
    returning id into new_group;
  insert into public.group_members (group_id, user_id, display_name)
    values (new_group, me, btrim(member_name));
  return new_group;
end;
$$;

-- Returns the group's id, or null when no group has that code. At most 10 wrong codes an hour.
create function public.join_group(code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  found uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if exists (select 1 from public.group_members where user_id = me) then
    raise exception 'Already in a group' using errcode = 'KG001';
  end if;
  if (select count(*) from private.join_attempts
      where user_id = me and tried_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many wrong codes, try again in an hour' using errcode = 'KG002';
  end if;

  select id into found from public.groups where invite_code = upper(btrim(code));
  if found is null then
    -- Returning (not raising) keeps this row: a raised error would undo it.
    insert into private.join_attempts (user_id) values (me);
    return null;
  end if;
  if (select count(*) from public.group_members where group_id = found) >= 50 then
    raise exception 'This group is full' using errcode = 'KG003';
  end if;
  insert into public.group_members (group_id, user_id, display_name)
    values (found, me, btrim(member_name));
  return found;
end;
$$;

create function public.leave_group()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  delete from public.group_members where user_id = auth.uid();
end;
$$;

-- A fresh code for your group; the old one stops working (for a code that went too far).
create function public.new_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine uuid := private.my_group_id();
  code text;
begin
  if mine is null then
    raise exception 'Not in a group' using errcode = 'KG004';
  end if;
  loop
    code := private.random_invite_code();
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  update public.groups set invite_code = code where id = mine;
  return code;
end;
$$;

-- Only signed-in people may call them (Supabase lets everyone run new functions by default).
revoke execute on function public.create_group(text, text) from public, anon;
revoke execute on function public.join_group(text, text) from public, anon;
revoke execute on function public.leave_group() from public, anon;
revoke execute on function public.new_invite_code() from public, anon;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text, text) to authenticated;
grant execute on function public.leave_group() to authenticated;
grant execute on function public.new_invite_code() to authenticated;

-- 6. Row Level Security: a group's rows are for its members only; signed-out requests get nothing.

alter table public.groups enable row level security;
revoke all on table public.groups from anon, public, authenticated;
grant select on table public.groups to authenticated;
create policy "Members see their group" on public.groups
  for select to authenticated
  using (id = (select private.my_group_id()));

alter table public.group_members enable row level security;
revoke all on table public.group_members from anon, public, authenticated;
grant select on table public.group_members to authenticated;
-- Only the name can be changed, and only your own.
grant update (display_name) on table public.group_members to authenticated;
create policy "Members see who is in their group" on public.group_members
  for select to authenticated
  using (group_id = (select private.my_group_id()));
create policy "Change your own name" on public.group_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.shared_foods enable row level security;
revoke all on table public.shared_foods from anon, public, authenticated;
grant select, insert, update, delete on table public.shared_foods to authenticated;
create policy "Members see their group's foods" on public.shared_foods
  for select to authenticated
  using (group_id = (select private.my_group_id()));
create policy "Share your own foods with your group" on public.shared_foods
  for insert to authenticated
  with check (created_by = (select auth.uid()) and group_id = (select private.my_group_id()));
create policy "Only the sharer changes a shared food" on public.shared_foods
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()) and group_id = (select private.my_group_id()));
create policy "Only the sharer removes a shared food" on public.shared_foods
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- The `exists (… shared_foods …)` parts see only foods the person may see (the policies above),
-- so a flag is readable and writable only inside the person's own group.
alter table public.shared_food_flags enable row level security;
revoke all on table public.shared_food_flags from anon, public, authenticated;
grant select, insert, update, delete on table public.shared_food_flags to authenticated;
create policy "Members see flags on their group's foods" on public.shared_food_flags
  for select to authenticated
  using (exists (select 1 from public.shared_foods as food where food.id = shared_food_id));
create policy "Flag someone else's food in your group" on public.shared_food_flags
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shared_foods as food
                where food.id = shared_food_id and food.created_by <> (select auth.uid())));
create policy "Change your own flag" on public.shared_food_flags
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shared_foods as food
                where food.id = shared_food_id and food.created_by <> (select auth.uid())));
-- Your own flag, or any flag on a food you shared (*Mark as fixed*).
create policy "Remove your flag, or flags on your food" on public.shared_food_flags
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.shared_foods as food
               where food.id = shared_food_id and food.created_by = (select auth.uid())));
