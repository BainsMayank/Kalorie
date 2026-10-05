-- Kalorie — Stage 11a: the tables that mirror user.db (SPEC §4.3).
--
-- Each table has the same columns as its user.db table (src/db/user/schema.ts), plus
-- `user_id`: whose row it is. SQLite types become Postgres types like this:
--   text → text · real → double precision · integer → bigint · integer (true/false) → boolean
-- Times stay as epoch milliseconds (bigint), exactly as the phone stores them, so a row can go
-- up and come back down unchanged. src/db/cloud/migrations.test.ts checks that the columns here
-- still match user.db, so a new user.db column can't be forgotten.
--
-- Nothing is uploaded yet: sync comes in Stage 11b. The phone stays the source of truth, so the
-- server keeps only the primary key and NOT NULL rules; the phone checks everything else.
--
-- Left out on purpose (they only matter on one phone, for a day or a week):
-- barcode_queue, limit_alerts, weekly_checkins.
--
-- `user_id` defaults to the signed-in person (auth.uid()), and deleting the account deletes
-- every row (on delete cascade).

create table public.profile (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id           bigint not null,
  sex          text,
  birth_year   bigint,
  height_cm    double precision,
  activity     text,
  goal         text,
  pace_kg_week double precision,
  onboarded_at bigint,
  updated_at   bigint not null,
  primary key (user_id, id)
);

create table public.targets (
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id              text not null,
  effective_from  text not null,
  kcal            double precision,
  protein_g       double precision,
  carb_g          double precision,
  fat_g           double precision,
  fibre_g         double precision,
  sodium_mg_limit double precision not null,
  sugar_g_limit   double precision not null,
  sat_fat_g_limit double precision not null,
  fat_g_limit     double precision not null,
  is_custom       boolean not null,
  created_at      bigint not null,
  updated_at      bigint not null,
  deleted_at      bigint,
  primary key (user_id, id)
);

create table public.settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key     text not null,
  value   text not null,
  primary key (user_id, key)
);

create table public.meal_slots (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  name       text,
  position   bigint not null,
  start_min  bigint not null,
  end_min    bigint not null,
  is_hidden  boolean not null,
  is_builtin boolean not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

create table public.log_entries (
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id              text not null,
  day             text not null,
  logged_at       bigint not null,
  slot_id         text not null,
  food_source     text not null,
  food_id         text,
  name            text not null,
  qty             double precision,
  unit            text,
  grams           double precision,
  oil_level       bigint not null,
  quick_kcal      double precision,
  quick_protein_g double precision,
  quick_carb_g    double precision,
  quick_fat_g     double precision,
  note            text,
  batch_id        text,
  created_at      bigint not null,
  updated_at      bigint not null,
  deleted_at      bigint,
  primary key (user_id, id)
);

create table public.favourites (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_source text not null,
  food_id     text not null,
  created_at  bigint not null,
  primary key (user_id, food_source, food_id)
);

create table public.custom_foods (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id               text not null,
  kind             text not null,
  name             text not null,
  brand            text,
  barcode          text,
  serving_g        double precision,
  density_g_per_ml double precision not null,
  cooked_with_fat  boolean not null,
  yield_g          double precision,
  servings         double precision,
  off_status       text,
  off_fetched_at   bigint,
  label_photo_uri  text,
  shared_food_id   text,
  energy_kcal      double precision,
  protein_g        double precision,
  carb_g           double precision,
  fat_g            double precision,
  fibre_g          double precision,
  sugar_g          double precision,
  sat_fat_g        double precision,
  mufa_g           double precision,
  pufa_g           double precision,
  trans_fat_g      double precision,
  cholesterol_mg   double precision,
  sodium_mg        double precision,
  potassium_mg     double precision,
  calcium_mg       double precision,
  iron_mg          double precision,
  magnesium_mg     double precision,
  phosphorus_mg    double precision,
  zinc_mg          double precision,
  copper_mg        double precision,
  manganese_mg     double precision,
  selenium_ug      double precision,
  iodine_ug        double precision,
  vit_a_ug         double precision,
  thiamine_mg      double precision,
  riboflavin_mg    double precision,
  niacin_mg        double precision,
  pantothenic_mg   double precision,
  vit_b6_mg        double precision,
  biotin_ug        double precision,
  folate_ug        double precision,
  vit_b12_ug       double precision,
  vit_c_mg         double precision,
  vit_d_ug         double precision,
  vit_e_mg         double precision,
  vit_k_ug         double precision,
  created_at       bigint not null,
  updated_at       bigint not null,
  deleted_at       bigint,
  primary key (user_id, id)
);

create table public.custom_food_units (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id             text not null,
  custom_food_id text not null,
  unit           text not null,
  label          text not null,
  grams          double precision not null,
  is_default     boolean not null,
  created_at     bigint not null,
  updated_at     bigint not null,
  deleted_at     bigint,
  primary key (user_id, id)
);

create table public.recipe_items (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id             text not null,
  recipe_id      text not null,
  position       bigint not null,
  food_source    text not null,
  food_id        text not null,
  name           text not null,
  qty            double precision not null,
  unit           text not null,
  grams          double precision not null,
  is_fat         boolean not null,
  energy_kcal    double precision,
  protein_g      double precision,
  carb_g         double precision,
  fat_g          double precision,
  fibre_g        double precision,
  sugar_g        double precision,
  sat_fat_g      double precision,
  mufa_g         double precision,
  pufa_g         double precision,
  trans_fat_g    double precision,
  cholesterol_mg double precision,
  sodium_mg      double precision,
  potassium_mg   double precision,
  calcium_mg     double precision,
  iron_mg        double precision,
  magnesium_mg   double precision,
  phosphorus_mg  double precision,
  zinc_mg        double precision,
  copper_mg      double precision,
  manganese_mg   double precision,
  selenium_ug    double precision,
  iodine_ug      double precision,
  vit_a_ug       double precision,
  thiamine_mg    double precision,
  riboflavin_mg  double precision,
  niacin_mg      double precision,
  pantothenic_mg double precision,
  vit_b6_mg      double precision,
  biotin_ug      double precision,
  folate_ug      double precision,
  vit_b12_ug     double precision,
  vit_c_mg       double precision,
  vit_d_ug       double precision,
  vit_e_mg       double precision,
  vit_k_ug       double precision,
  created_at     bigint not null,
  updated_at     bigint not null,
  deleted_at     bigint,
  primary key (user_id, id)
);

create table public.my_thalis (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  name       text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

create table public.my_thali_items (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null,
  thali_id    text not null,
  position    bigint not null,
  food_source text not null,
  food_id     text not null,
  name        text not null,
  qty         double precision not null,
  unit        text not null,
  grams       double precision not null,
  oil_level   bigint not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint,
  primary key (user_id, id)
);

create table public.weights (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  day        text not null,
  weight_kg  double precision not null,
  logged_at  bigint not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

create table public.water_logs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  day        text not null,
  logged_at  bigint not null,
  ml         bigint not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: a signed-in person can read, add, change and delete only rows whose
-- user_id is their own. Signed-out requests (the `anon` role) can't touch these tables at all.
--
-- `(select auth.uid())` instead of `auth.uid()`: Postgres then works it out once per query
-- instead of once per row (Supabase's advice for fast policies).
-- One `for all` policy covers select, insert, update and delete: `using` decides which rows
-- can be seen, changed or deleted; `with check` decides what a new or changed row may contain
-- (so nobody can write a row with someone else's user_id, or move a row to them).
-- supabase/tests/rls.test.sql proves it with two people.
-- ---------------------------------------------------------------------------------------------

alter table public.profile enable row level security;
revoke all on table public.profile from anon, public;
grant select, insert, update, delete on table public.profile to authenticated;
create policy "Only your own rows" on public.profile
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.targets enable row level security;
revoke all on table public.targets from anon, public;
grant select, insert, update, delete on table public.targets to authenticated;
create policy "Only your own rows" on public.targets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.settings enable row level security;
revoke all on table public.settings from anon, public;
grant select, insert, update, delete on table public.settings to authenticated;
create policy "Only your own rows" on public.settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.meal_slots enable row level security;
revoke all on table public.meal_slots from anon, public;
grant select, insert, update, delete on table public.meal_slots to authenticated;
create policy "Only your own rows" on public.meal_slots
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.log_entries enable row level security;
revoke all on table public.log_entries from anon, public;
grant select, insert, update, delete on table public.log_entries to authenticated;
create policy "Only your own rows" on public.log_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.favourites enable row level security;
revoke all on table public.favourites from anon, public;
grant select, insert, update, delete on table public.favourites to authenticated;
create policy "Only your own rows" on public.favourites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.custom_foods enable row level security;
revoke all on table public.custom_foods from anon, public;
grant select, insert, update, delete on table public.custom_foods to authenticated;
create policy "Only your own rows" on public.custom_foods
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.custom_food_units enable row level security;
revoke all on table public.custom_food_units from anon, public;
grant select, insert, update, delete on table public.custom_food_units to authenticated;
create policy "Only your own rows" on public.custom_food_units
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.recipe_items enable row level security;
revoke all on table public.recipe_items from anon, public;
grant select, insert, update, delete on table public.recipe_items to authenticated;
create policy "Only your own rows" on public.recipe_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.my_thalis enable row level security;
revoke all on table public.my_thalis from anon, public;
grant select, insert, update, delete on table public.my_thalis to authenticated;
create policy "Only your own rows" on public.my_thalis
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.my_thali_items enable row level security;
revoke all on table public.my_thali_items from anon, public;
grant select, insert, update, delete on table public.my_thali_items to authenticated;
create policy "Only your own rows" on public.my_thali_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.weights enable row level security;
revoke all on table public.weights from anon, public;
grant select, insert, update, delete on table public.weights to authenticated;
create policy "Only your own rows" on public.weights
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.water_logs enable row level security;
revoke all on table public.water_logs from anon, public;
grant select, insert, update, delete on table public.water_logs to authenticated;
create policy "Only your own rows" on public.water_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
