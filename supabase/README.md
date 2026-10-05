# Supabase (Stage 11)

Kalorie's optional online part. The app works fully without it; see SPEC.md §4.3.

## Files

- `migrations/` — the database, in order. Each file runs once.
  - `20260928100000_user_data.sql` — 13 tables that mirror user.db, each with Row Level
    Security: a signed-in person can only read and write their own rows.
  - `20260928100100_delete_account.sql` — `delete_my_account()`, used by
    Profile → Account → *Delete my account and data*.
  - `20260928110000_groups.sql` — groups and shared foods (Stage 11c): `groups`,
    `group_members`, `shared_foods`, `shared_food_flags`, and the functions the app calls to start,
    join and leave a group or make a new invite code. Only members see a group's rows; only the
    person who shared a food can change it.
- `tests/rls.test.sql` — proves person A can't read or change person B's data, that groups,
  shared foods and flags stay inside their group, that signed-out requests are refused, and that
  deleting an account removes all its rows. Changes nothing.

## Applying the migrations (no command line needed)

Supabase dashboard → **SQL Editor** → **New query** → paste a migration file → **Run**.
Do the files in name order, each exactly once. "Success. No rows returned" means it worked.

## Running the RLS test

Same place: paste all of `tests/rls.test.sql` → **Run**. It should show one row starting with
`PASS`. Anything starting with `FAIL:` names the table and what went wrong. Run it again after
every new migration.

`npm test` also checks these files without a server (`src/db/cloud/migrations.test.ts`): the
tables still match user.db, every table has Row Level Security, and the RLS test covers them all.

## Keys

- The app uses the **Project URL** and the **publishable** (or legacy **anon**) key, from `.env`.
- The **secret / service_role** key skips Row Level Security. It never goes in the app, in
  `.env`, or in git. Nothing in this project needs it.
