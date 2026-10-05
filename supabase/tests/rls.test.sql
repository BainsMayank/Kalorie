-- Kalorie — proof that Row Level Security keeps each person's data to themselves.
--
-- How to run it: Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
-- It needs no keys and changes nothing: it works inside one transaction and rolls it back.
--   Passed → the result is one row: "PASS — …".
--   Failed → an error that starts with "FAIL:" and says which table and what went wrong.
--
-- What it does, with two made-up people, A and B:
--   1. Both save one row in every Kalorie table (with the same ids — ids only need to be
--      unique per person).
--   2. As A, and then as B, for every table:
--        · they see exactly 1 row (their own) and none of the other person's;
--        · changing or deleting the other person's rows changes nothing;
--        · writing a row with the other person's user_id is refused;
--        · handing their own row over to the other person is refused.
--   3. Signed out (the `anon` role): every table and delete_my_account() are refused.
--   4. Groups (Stage 11c), with two more people, C and D: A starts a group and B joins with its
--      invite code, C starts another group, D is in none.
--        · each person sees only their own group, its people, its shared foods and its flags;
--        · nobody gets into a group without its code, or by writing the tables directly;
--        · only the person who shared a food can change or remove it; anyone else in the group
--          can flag it; nobody outside can see, change or flag it;
--        · after 10 wrong codes in an hour even the right one is refused; a new code stops the
--          old one working;
--        · leaving takes your shared foods and flags with you; the last person out ends the group;
--        · signed out, none of it can be read or called.
--   5. A deletes their account: all of A's rows are gone, all of B's are still there, and A's
--      shared foods leave the group.
--
-- src/db/cloud/migrations.test.ts checks that the table list below names every table that
-- mirrors user.db, and that step 4 covers every group table, so a new table can't skip this test.

begin;

-- 0. Four people, only for this test (the rollback at the end removes them).
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'rls-test-a@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'rls-test-b@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'authenticated', 'authenticated', 'rls-test-c@example.com'),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'authenticated', 'authenticated', 'rls-test-d@example.com');

-- The tables that mirror user.db, and the people, kept as settings for this transaction so every
-- step below can read them whichever role it runs as.
select set_config('rls_test.tables', 'profile,targets,settings,meal_slots,log_entries,favourites,'
    || 'custom_foods,custom_food_units,recipe_items,my_thalis,my_thali_items,weights,water_logs',
    true),
  set_config('rls_test.a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true),
  set_config('rls_test.b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true),
  set_config('rls_test.c', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true),
  set_config('rls_test.d', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);

-- From here on, act like the app does: as a signed-in person, never as the database owner.
set local role authenticated;

-- 1. A and B each save one row in every table. user_id is left out: it fills itself in with
--    whoever is signed in.
do $$
declare
  a uuid := current_setting('rls_test.a')::uuid;
  b uuid := current_setting('rls_test.b')::uuid;
  person uuid;
begin
  foreach person in array array[a, b] loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', person, 'role', 'authenticated')::text, true);

    insert into public.profile (id, sex, birth_year, updated_at) values (1, 'f', 1990, 0);
    insert into public.targets (id, effective_from, kcal, sodium_mg_limit, sugar_g_limit,
      sat_fat_g_limit, fat_g_limit, is_custom, created_at, updated_at)
      values ('targets-1', '2026-09-01', 1800, 2000, 45, 20, 60, false, 0, 0);
    insert into public.settings (key, value) values ('theme', '"dark"');
    insert into public.meal_slots (id, position, start_min, end_min, is_hidden, is_builtin,
      created_at, updated_at) values ('lunch', 1, 660, 960, false, true, 0, 0);
    insert into public.log_entries (id, day, logged_at, slot_id, food_source, food_id, name, qty,
      unit, grams, oil_level, created_at, updated_at)
      values ('entry-1', '2026-09-28', 0, 'lunch', 'base', '123', 'Dal', 1, 'katori', 150, 0, 0, 0);
    insert into public.favourites (food_source, food_id, created_at) values ('base', '123', 0);
    insert into public.custom_foods (id, kind, name, density_g_per_ml, cooked_with_fat,
      energy_kcal, created_at, updated_at)
      values ('food-1', 'recipe', 'Mom''s rajma', 1, true, 140, 0, 0);
    insert into public.custom_food_units (id, custom_food_id, unit, label, grams, is_default,
      created_at, updated_at) values ('unit-1', 'food-1', 'serving', 'serving', 250, true, 0, 0);
    insert into public.recipe_items (id, recipe_id, position, food_source, food_id, name, qty,
      unit, grams, is_fat, created_at, updated_at)
      values ('item-1', 'food-1', 0, 'base', '42', 'Rajma', 1, 'katori', 100, false, 0, 0);
    insert into public.my_thalis (id, name, created_at, updated_at)
      values ('thali-1', 'Lunch thali', 0, 0);
    insert into public.my_thali_items (id, thali_id, position, food_source, food_id, name, qty,
      unit, grams, oil_level, created_at, updated_at)
      values ('thali-item-1', 'thali-1', 0, 'base', '123', 'Dal', 1, 'katori', 150, 0, 0, 0);
    insert into public.weights (id, day, weight_kg, logged_at, created_at, updated_at)
      values ('weight-1', '2026-09-28', 62.5, 0, 0, 0);
    insert into public.water_logs (id, day, logged_at, ml, created_at, updated_at)
      values ('water-1', '2026-09-28', 0, 250, 0, 0);
  end loop;
end $$;

-- 2. As A, then as B: read, change, delete and write the other person's rows.
do $$
declare
  a uuid := current_setting('rls_test.a')::uuid;
  b uuid := current_setting('rls_test.b')::uuid;
  me uuid;
  other uuid;
  t text;
  n bigint;
  refused boolean;
begin
  for turn in 1..2 loop
    me := case when turn = 1 then a else b end;
    other := case when turn = 1 then b else a end;
    perform set_config('request.jwt.claims',
      json_build_object('sub', me, 'role', 'authenticated')::text, true);

    foreach t in array string_to_array(current_setting('rls_test.tables'), ',') loop
      -- Reading: only my own row.
      execute format('select count(*) from public.%I', t) into n;
      if n <> 1 then
        raise exception 'FAIL: % sees % rows in %, expected only their own 1', me, n, t;
      end if;
      execute format('select count(*) from public.%I where user_id = %L', t, other) into n;
      if n <> 0 then
        raise exception 'FAIL: % can read % of the other person''s rows in %', me, n, t;
      end if;

      -- Changing and deleting the other person's rows: nothing happens.
      execute format('update public.%I set user_id = user_id where user_id = %L', t, other);
      get diagnostics n = row_count;
      if n <> 0 then
        raise exception 'FAIL: % changed % of the other person''s rows in %', me, n, t;
      end if;
      execute format('delete from public.%I where user_id = %L', t, other);
      get diagnostics n = row_count;
      if n <> 0 then
        raise exception 'FAIL: % deleted % of the other person''s rows in %', me, n, t;
      end if;

      -- Writing a row with the other person's user_id: refused. (A copy of my own row with
      -- the user_id swapped.) Any other error, or no error, means the policy didn't stop it.
      refused := false;
      begin
        execute format(
          'insert into public.%1$I select (jsonb_populate_record(null::public.%1$I,
             to_jsonb(mine) || jsonb_build_object(''user_id'', %2$L))).*
           from public.%1$I mine', t, other);
      exception
        when insufficient_privilege then refused := true;
        when others then
          raise exception 'FAIL: % could write a row as the other person in % (it only stopped '
            'at: %)', me, t, sqlerrm;
      end;
      if not refused then
        raise exception 'FAIL: % wrote a row as the other person in %', me, t;
      end if;

      -- Handing my own row over to the other person: refused.
      refused := false;
      begin
        execute format('update public.%I set user_id = %L', t, other);
      exception
        when insufficient_privilege then refused := true;
        when others then
          raise exception 'FAIL: % could move their row to the other person in % (it only '
            'stopped at: %)', me, t, sqlerrm;
      end;
      if not refused then
        raise exception 'FAIL: % moved their row to the other person in %', me, t;
      end if;
    end loop;
  end loop;
end $$;

-- 3. Signed out: no table and no account deletion.
reset role;
set local role anon;
do $$
declare
  t text;
  refused boolean;
begin
  foreach t in array string_to_array(current_setting('rls_test.tables'), ',') loop
    refused := false;
    begin
      execute format('select count(*) from public.%I', t);
    exception when insufficient_privilege then
      refused := true;
    end;
    if not refused then
      raise exception 'FAIL: signed out, % can still be read', t;
    end if;
  end loop;

  refused := false;
  begin
    perform public.delete_my_account();
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then
    raise exception 'FAIL: signed out, delete_my_account() can still be called';
  end if;
end $$;

-- 4. Groups (Stage 11c). A starts "Family" and B joins it with the invite code; C starts
--    "Friends"; D is in no group. Tables: public.groups, public.group_members,
--    public.shared_foods, public.shared_food_flags.
--    Small helpers first (temporary: they vanish with this session).
reset role;

-- Act as someone.
create function pg_temp.act_as(person text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', current_setting('rls_test.' || person), 'role', 'authenticated')::text,
    true)
$$;
-- Stops the test with "FAIL: …" unless `ok`.
create function pg_temp.expect(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAIL: %', message;
  end if;
end $$;
-- Runs a statement and answers how many rows it changed.
create function pg_temp.changed(statement text) returns bigint language plpgsql as $$
declare
  n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end $$;
-- Runs a statement that must be stopped; answers the error code that stopped it (42501 = no
-- permission / Row Level Security, KG… = Kalorie's own reasons), or 'not refused'.
create function pg_temp.refusal(statement text) returns text language plpgsql as $$
begin
  execute statement;
  return 'not refused';
exception when others then
  return sqlstate;
end $$;
-- Counts rows of a query.
create function pg_temp.count_of(query text) returns bigint language plpgsql as $$
declare
  n bigint;
begin
  execute format('select count(*) from (%s) as q', query) into n;
  return n;
end $$;

set local role authenticated;

-- 4a. Starting groups, and joining one with its code.
do $$
declare
  family uuid;
  friends uuid;
  code text;
begin
  perform pg_temp.act_as('a');
  family := public.create_group('Family', 'Asha');
  select invite_code into code from public.groups where id = family;
  perform pg_temp.expect(code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$',
    'the invite code should be 6 letters and digits, it is ' || coalesce(code, 'missing'));
  perform set_config('rls_test.family', family::text, true);
  perform set_config('rls_test.code', code, true);

  perform pg_temp.act_as('c');
  friends := public.create_group('Friends', 'Chetan');
  perform set_config('rls_test.friends', friends::text, true);
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.groups') = 1,
    'C should see only their own group');
  perform pg_temp.expect(pg_temp.count_of(format(
      'select 1 from public.groups where id = %L or invite_code = %L', family, code)) = 0,
    'C can see the Family group or its invite code');

  perform pg_temp.act_as('b');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.groups') = 0,
    'B sees a group before joining one');
  perform pg_temp.expect(public.join_group('ZZZZZZ', 'Bela') is null,
    'a wrong code should join nothing');
  -- Typed in small letters with spaces around it: still the same code.
  perform pg_temp.expect(public.join_group(' ' || lower(code) || ' ', 'Bela') = family,
    'B could not join with the invite code');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.group_members') = 2,
    'B should see both people in Family');
  perform pg_temp.expect(pg_temp.count_of(format(
      'select 1 from public.group_members where group_id = %L', friends)) = 0,
    'B can see who is in Friends');
  perform pg_temp.expect(pg_temp.refusal(format(
      'select public.join_group(%L, %L)', code, 'Bela')) = 'KG001',
    'B could join a second time');
  perform pg_temp.expect(pg_temp.refusal(format(
      'select public.create_group(%L, %L)', 'Another', 'Bela')) = 'KG001',
    'B could start a second group while in one');
end $$;

-- 4b. Nobody gets into a group, or moves between groups, by writing the tables directly.
do $$
begin
  perform pg_temp.act_as('d');
  perform pg_temp.expect(pg_temp.refusal(format(
      'insert into public.group_members (group_id, display_name) values (%L, %L)',
      current_setting('rls_test.family'), 'Dev')) = '42501',
    'D could add themselves to Family without the code');
  perform pg_temp.expect(pg_temp.refusal(
      'insert into public.groups (name, invite_code) values (''Mine'', ''ABCDEF'')') = '42501',
    'D could make a group row directly');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.groups') = 0
      and pg_temp.count_of('select 1 from public.group_members') = 0,
    'D, in no group, can see a group or its people');

  perform pg_temp.act_as('b');
  perform pg_temp.expect(pg_temp.refusal(format(
      'update public.group_members set group_id = %L', current_setting('rls_test.friends'))) = '42501',
    'B could move themselves into Friends');
  perform pg_temp.expect(pg_temp.refusal(
      'update public.groups set invite_code = ''ABCDEF''') = '42501',
    'B could change the invite code directly');
  perform pg_temp.expect(pg_temp.refusal(
      'delete from public.group_members') = '42501',
    'B could remove people from the group directly');
  perform pg_temp.expect(pg_temp.changed(format(
      'update public.group_members set display_name = %L where user_id = %L',
      'Not Asha', current_setting('rls_test.a'))) = 0,
    'B changed A''s name');
  perform pg_temp.expect(pg_temp.changed(format(
      'update public.group_members set display_name = %L where user_id = %L',
      'Bela B', current_setting('rls_test.b'))) = 1,
    'B could not change their own name');
end $$;

-- 4c. Shared foods: seen only inside the group, changed only by the person who shared them.
do $$
declare
  family text := current_setting('rls_test.family');
  friends text := current_setting('rls_test.friends');
  insert_food constant text := 'insert into public.shared_foods (id, group_id, kind, name, nutrients, '
    || 'units) values (%L, %L, ''recipe'', %L, ''{"energy_kcal": 140}'', '
    || '''[{"unit": "serving", "label": "serving", "grams": 250, "is_default": true}]'')';
begin
  perform pg_temp.act_as('a');
  execute format(insert_food, '11111111-1111-4111-8111-111111111111', family, 'Mom''s rajma');
  perform pg_temp.act_as('b');
  execute format(insert_food, '22222222-2222-4222-8222-222222222222', family, 'Bela''s poha');
  perform pg_temp.act_as('c');
  execute format(insert_food, '33333333-3333-4333-8333-333333333333', friends, 'Chetan''s dal');

  perform pg_temp.act_as('a');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_foods') = 2,
    'A should see the 2 Family foods');
  perform pg_temp.act_as('b');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_foods') = 2,
    'B should see the 2 Family foods');
  perform pg_temp.act_as('c');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_foods') = 1,
    'C should see only Friends'' food');
  perform pg_temp.act_as('d');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_foods') = 0,
    'D, in no group, can see shared foods');

  -- Someone else's food in the same group: B can't change or remove A's.
  perform pg_temp.act_as('b');
  perform pg_temp.expect(pg_temp.changed(
      'update public.shared_foods set name = ''Changed'' '
      || 'where id = ''11111111-1111-4111-8111-111111111111''') = 0,
    'B changed A''s shared food');
  perform pg_temp.expect(pg_temp.changed(
      'delete from public.shared_foods where id = ''11111111-1111-4111-8111-111111111111''') = 0,
    'B deleted A''s shared food');
  -- Sharing as someone else, into another group, or moving a food out: refused.
  perform pg_temp.expect(pg_temp.refusal(format(
      'insert into public.shared_foods (id, group_id, created_by, kind, name, nutrients) '
      || 'values (gen_random_uuid(), %L, %L, ''custom'', ''Fake'', ''{}'')',
      family, current_setting('rls_test.a'))) = '42501',
    'B shared a food in A''s name');
  perform pg_temp.expect(pg_temp.refusal(format(insert_food,
      '44444444-4444-4444-8444-444444444444', friends, 'Sneaky')) = '42501',
    'B shared a food into Friends');
  perform pg_temp.expect(pg_temp.refusal(format(
      'update public.shared_foods set group_id = %L '
      || 'where id = ''22222222-2222-4222-8222-222222222222''', friends)) = '42501',
    'B moved their food into Friends');
  perform pg_temp.expect(pg_temp.refusal(format(
      'update public.shared_foods set created_by = %L '
      || 'where id = ''22222222-2222-4222-8222-222222222222''', current_setting('rls_test.a'))) = '42501',
    'B handed their food over to A');
  perform pg_temp.expect(pg_temp.changed(
      'update public.shared_foods set name = ''Bela''''s kanda poha'' '
      || 'where id = ''22222222-2222-4222-8222-222222222222''') = 1,
    'B could not change their own shared food');

  -- Another group's food: C can't change or remove it; D can't share into Family.
  perform pg_temp.act_as('c');
  perform pg_temp.expect(pg_temp.changed(
      'update public.shared_foods set name = ''Changed'' '
      || 'where id = ''11111111-1111-4111-8111-111111111111''') = 0,
    'C changed a Family food');
  perform pg_temp.expect(pg_temp.changed(
      'delete from public.shared_foods where id = ''11111111-1111-4111-8111-111111111111''') = 0,
    'C deleted a Family food');
  perform pg_temp.act_as('d');
  perform pg_temp.expect(pg_temp.refusal(format(insert_food,
      '55555555-5555-4555-8555-555555555555', family, 'Sneaky')) = '42501',
    'D, in no group, shared a food into Family');
end $$;

-- 4d. Flags: anyone else in the group can flag a food; only the group sees flags.
do $$
declare
  rajma constant text := '11111111-1111-4111-8111-111111111111';
  flag constant text := 'insert into public.shared_food_flags (shared_food_id, reason, note) '
    || 'values (%L, ''kcal'', ''Looks high'')';
begin
  perform pg_temp.act_as('b');
  execute format(flag, rajma);
  perform pg_temp.expect(pg_temp.changed(format(
      'update public.shared_food_flags set reason = ''nutrients'' where shared_food_id = %L',
      rajma)) = 1,
    'B could not change their own flag');

  perform pg_temp.act_as('a');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_food_flags') = 1,
    'A should see B''s flag on their food');
  perform pg_temp.expect(pg_temp.refusal(format(flag, rajma)) = '42501',
    'A could flag their own food');

  perform pg_temp.act_as('c');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_food_flags') = 0,
    'C can see flags in Family');
  perform pg_temp.expect(pg_temp.refusal(format(flag, rajma)) = '42501',
    'C flagged a Family food');
  perform pg_temp.expect(pg_temp.changed('delete from public.shared_food_flags') = 0,
    'C deleted a flag in Family');

  perform pg_temp.act_as('d');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_food_flags') = 0,
    'D, in no group, can see flags');

  -- The sharer clears flags on their food once it is fixed; then B flags it again.
  perform pg_temp.act_as('a');
  perform pg_temp.expect(pg_temp.changed('delete from public.shared_food_flags') = 1,
    'A could not clear the flag on their own food');
  perform pg_temp.act_as('b');
  execute format(flag, rajma);
end $$;

-- 4e. Signed out: none of the group tables or functions.
reset role;
set local role anon;
do $$
declare
  t text;
begin
  foreach t in array array['groups', 'group_members', 'shared_foods', 'shared_food_flags'] loop
    perform pg_temp.expect(pg_temp.refusal(format('select 1 from public.%I', t)) = '42501',
      'signed out, ' || t || ' can still be read');
  end loop;
  perform pg_temp.expect(pg_temp.refusal('select public.create_group(''X'', ''Y'')') = '42501',
    'signed out, create_group() can still be called');
  perform pg_temp.expect(pg_temp.refusal('select public.join_group(''ABCDEF'', ''Y'')') = '42501',
    'signed out, join_group() can still be called');
  perform pg_temp.expect(pg_temp.refusal('select public.leave_group()') = '42501',
    'signed out, leave_group() can still be called');
  perform pg_temp.expect(pg_temp.refusal('select public.new_invite_code()') = '42501',
    'signed out, new_invite_code() can still be called');
end $$;
reset role;
set local role authenticated;

-- 4f. Guessing codes: after 10 wrong codes in an hour even the right one is refused. A fresh
--     code stops the old one working.
do $$
declare
  old_code text := current_setting('rls_test.code');
  new_code text;
begin
  perform pg_temp.act_as('d');
  for i in 1..10 loop
    perform pg_temp.expect(public.join_group('WRONG' || chr(64 + i), 'Dev') is null,
      'a wrong code joined a group');
  end loop;
  perform pg_temp.expect(pg_temp.refusal(format(
      'select public.join_group(%L, %L)', old_code, 'Dev')) = 'KG002',
    'D could keep trying codes after 10 wrong ones');
  perform pg_temp.expect(pg_temp.refusal('select public.new_invite_code()') = 'KG004',
    'D, in no group, made an invite code');

  perform pg_temp.act_as('b');
  new_code := public.new_invite_code();
  perform pg_temp.expect(new_code <> old_code, 'the new code is the same as the old one');
  perform set_config('rls_test.code', new_code, true);
  perform pg_temp.act_as('c');
  perform public.leave_group();
  perform pg_temp.expect(public.join_group(old_code, 'Chetan') is null,
    'the old code still works after a new one was made');
end $$;

-- 4g. Leaving: B's shared food and flag go with B, A's stay; B sees nothing of Family any more.
--     C left Friends above as its last person, so Friends is gone.
do $$
begin
  perform pg_temp.act_as('b');
  perform public.leave_group();
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.groups') = 0
      and pg_temp.count_of('select 1 from public.group_members') = 0
      and pg_temp.count_of('select 1 from public.shared_foods') = 0
      and pg_temp.count_of('select 1 from public.shared_food_flags') = 0,
    'after leaving, B can still see Family');

  perform pg_temp.act_as('a');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_foods') = 1,
    'after B left, A should see only their own food');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.shared_food_flags') = 0,
    'B''s flag stayed after B left');
  perform pg_temp.expect(pg_temp.count_of('select 1 from public.group_members') = 1,
    'B is still listed in Family');

  -- B joins again with the new code and shares a food, for step 5.
  perform pg_temp.act_as('b');
  perform pg_temp.expect(public.join_group(current_setting('rls_test.code'), 'Bela')
      = current_setting('rls_test.family')::uuid,
    'B could not join again with the new code');
  insert into public.shared_foods (id, group_id, kind, name, nutrients)
    values ('66666666-6666-4666-8666-666666666666', current_setting('rls_test.family')::uuid,
            'product', 'Bela''s biscuits', '{"energy_kcal": 480}');
  insert into public.shared_food_flags (shared_food_id, reason)
    values ('11111111-1111-4111-8111-111111111111', 'name');
end $$;
reset role;

do $$
begin
  perform pg_temp.expect(not exists (select 1 from public.groups
                                     where id = current_setting('rls_test.friends')::uuid),
    'Friends is still there after its last person left');
  perform pg_temp.expect(not exists (select 1 from public.shared_foods
                                     where id = '22222222-2222-4222-8222-222222222222'),
    'B''s shared food is still there after B left');
end $$;

-- 5. A deletes their account: everything of A's goes, everything of B's stays.
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('rls_test.a'), 'role', 'authenticated')::text, true);
  perform public.delete_my_account();
exception when others then
  raise exception 'FAIL: delete_my_account() stopped with: %', sqlerrm;
end $$;
reset role;

do $$
declare
  t text;
  n bigint;
  a uuid := current_setting('rls_test.a')::uuid;
  b uuid := current_setting('rls_test.b')::uuid;
begin
  if exists (select 1 from auth.users where id = a) then
    raise exception 'FAIL: A''s account is still there after delete_my_account()';
  end if;
  foreach t in array string_to_array(current_setting('rls_test.tables'), ',') loop
    execute format('select count(*) from public.%I where user_id = %L', t, a) into n;
    if n <> 0 then
      raise exception 'FAIL: % of A''s rows are left in % after deleting the account', n, t;
    end if;
    execute format('select count(*) from public.%I where user_id = %L', t, b) into n;
    if n <> 1 then
      raise exception 'FAIL: deleting A''s account changed B''s rows in %', t;
    end if;
  end loop;

  -- A's shared food and B's flag on it are gone; Family, B and B's food are still there.
  if exists (select 1 from public.shared_foods where created_by = a)
     or exists (select 1 from public.group_members where user_id = a) then
    raise exception 'FAIL: A''s shared foods or group place are left after deleting the account';
  end if;
  if exists (select 1 from public.shared_food_flags) then
    raise exception 'FAIL: flags on A''s shared food are left after deleting the account';
  end if;
  if not exists (select 1 from public.group_members
                 where user_id = b and group_id = current_setting('rls_test.family')::uuid)
     or not exists (select 1 from public.shared_foods where created_by = b) then
    raise exception 'FAIL: deleting A''s account changed B''s group or shared food';
  end if;
end $$;

rollback;

select 'PASS — each person sees and changes only their own rows in all 13 tables; groups, '
    || 'shared foods and flags are seen only inside their group and changed only by their '
    || 'owner; signed-out requests are refused; deleting an account removes all of its rows.'
    as result;
