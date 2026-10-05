import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as schema from '@/db/user/schema';

// Checks the Supabase SQL (supabase/) against user.db (src/db/user/schema.ts) without a server:
// every user.db table is either mirrored with the same columns or listed as phone-only, every
// Supabase table has Row Level Security, and the RLS test covers every table. The RLS behaviour
// itself is proven by supabase/tests/rls.test.sql, run against the real database.
// Besides the mirror tables there are the group tables (Stage 11c), which only exist online.

const root = join(__dirname, '../../../supabase');
const migrations = readdirSync(join(root, 'migrations'))
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(root, 'migrations', file), 'utf8'))
  .join('\n');
const rlsTest = readFileSync(join(root, 'tests/rls.test.sql'), 'utf8');

/** user.db tables that stay on the phone: they only matter for a day or a week (SPEC §4.3). */
const PHONE_ONLY = ['barcode_queue', 'limit_alerts', 'weekly_checkins'];

/** Tables that only exist online: groups and their shared foods (Stage 11c, SPEC §4.3). */
const GROUP_TABLES = ['groups', 'group_members', 'shared_foods', 'shared_food_flags'];

/** Functions the app calls; each must be closed to signed-out requests. */
const FUNCTIONS = [
  'delete_my_account()',
  'create_group(text, text)',
  'join_group(text, text)',
  'leave_group()',
  'new_invite_code()',
];

/** How each SQLite column type is written in Postgres. */
const POSTGRES_TYPE: Record<string, string> = {
  SQLiteText: 'text',
  SQLiteReal: 'double precision',
  SQLiteInteger: 'bigint',
  SQLiteBoolean: 'boolean',
};

const userDbTables = (Object.values(schema) as unknown[])
  .filter((value): value is SQLiteTable => is(value, SQLiteTable))
  .map((table) => getTableConfig(table));

/** Every `create table public.<name> (...)` in the migrations: name → its column lines. */
const supabaseTables = new Map(
  [...migrations.matchAll(/create table public\.(\w+) \(\n([\s\S]*?)\n\);/g)].map((match) => [
    match[1],
    match[2]
      .split('\n')
      .map((line) => line.trim().replace(/,$/, ''))
      .filter((line) => !line.startsWith('primary key')),
  ]),
);
// Columns added later (`alter table public.<name> add column …`) go at the end, like in SQLite.
// Their `default` is left out: it is only there so rows already online get a value.
for (const [, name, column] of migrations.matchAll(
  /alter table public\.(\w+) add column (.*?)(?: default [^;]*)?;/g,
)) {
  supabaseTables.get(name)!.push(column);
}
const mirrorTables = [...supabaseTables.keys()].filter((name) => !GROUP_TABLES.includes(name));

describe('Supabase tables', () => {
  it('mirrors every user.db table except the phone-only ones', () => {
    const mirrored = userDbTables.map((t) => t.name).filter((name) => !PHONE_ONLY.includes(name));
    expect([...mirrorTables].sort()).toEqual(mirrored.sort());
  });

  it('has the group tables, and nothing else', () => {
    expect(
      [...supabaseTables.keys()].filter((name) => !mirrorTables.includes(name)).sort(),
    ).toEqual([...GROUP_TABLES].sort());
  });

  it.each(userDbTables.filter((t) => !PHONE_ONLY.includes(t.name)).map((t) => [t.name, t]))(
    '%s has the same columns, types and NOT NULLs as user.db, plus user_id',
    (name, table) => {
      const expected = [
        'user_id uuid not null default auth.uid() references auth.users (id) on delete cascade',
        ...table.columns.map(
          (column) =>
            `${column.name} ${POSTGRES_TYPE[column.columnType]}${column.notNull ? ' not null' : ''}`,
        ),
      ];
      const actual = supabaseTables.get(name)!.map((line) => line.replace(/\s+/g, ' '));
      expect(actual).toEqual(expected);
    },
  );

  it.each(mirrorTables)(
    '%s is keyed by user_id first, so ids never clash between people',
    (name) => {
      expect(migrations).toMatch(
        new RegExp(`create table public\\.${name} \\([\\s\\S]*?primary key \\(user_id, `),
      );
    },
  );

  it.each(mirrorTables)('%s has Row Level Security: own rows only', (name) => {
    expect(migrations).toContain(`alter table public.${name} enable row level security;`);
    expect(migrations).toContain(`revoke all on table public.${name} from anon, public;`);
    expect(migrations).toContain(
      `create policy "Only your own rows" on public.${name}\n` +
        '  for all to authenticated\n' +
        '  using ((select auth.uid()) = user_id)\n' +
        '  with check ((select auth.uid()) = user_id);',
    );
  });

  it.each(GROUP_TABLES)(
    '%s has Row Level Security and is closed to signed-out requests',
    (name) => {
      expect(migrations).toContain(`alter table public.${name} enable row level security;`);
      expect(migrations).toContain(
        `revoke all on table public.${name} from anon, public, authenticated;`,
      );
    },
  );

  it('has no other policies that could widen access', () => {
    // One per mirror table, and the group tables' own: see 20260928110000_groups.sql.
    const policies = [...migrations.matchAll(/create policy "(.+?)" on public\.(\w+)/g)];
    expect(policies.filter(([, title]) => title === 'Only your own rows')).toHaveLength(
      mirrorTables.length,
    );
    expect(
      policies
        .filter(([, title]) => title !== 'Only your own rows')
        .map(([, title, table]) => `${table}: ${title}`),
    ).toEqual([
      'groups: Members see their group',
      'group_members: Members see who is in their group',
      'group_members: Change your own name',
      "shared_foods: Members see their group's foods",
      'shared_foods: Share your own foods with your group',
      'shared_foods: Only the sharer changes a shared food',
      'shared_foods: Only the sharer removes a shared food',
      "shared_food_flags: Members see flags on their group's foods",
      "shared_food_flags: Flag someone else's food in your group",
      'shared_food_flags: Change your own flag',
      'shared_food_flags: Remove your flag, or flags on your food',
    ]);
  });

  it.each(FUNCTIONS)('lets only signed-in people call %s', (fn) => {
    expect(migrations).toContain(`revoke execute on function public.${fn} from public, anon;`);
    expect(migrations).toContain(`grant execute on function public.${fn} to authenticated;`);
  });

  it('delete_my_account() deletes only the caller', () => {
    expect(migrations).toContain('delete from auth.users where id = me;');
  });

  it('the RLS test checks every mirror table and writes a row in each', () => {
    const listed = rlsTest
      .match(/set_config\('rls_test\.tables', ([\s\S]*?),\n\s+true\)/)![1]
      .replace(/'|\s|\|\|/g, '')
      .split(',');
    expect(listed.sort()).toEqual([...mirrorTables].sort());
    for (const name of mirrorTables) expect(rlsTest).toContain(`insert into public.${name} (`);
  });

  it('the RLS test checks every group table and function', () => {
    const groupPart = rlsTest.slice(rlsTest.indexOf('-- 4. Groups'), rlsTest.indexOf('-- 5.'));
    for (const name of GROUP_TABLES) expect(groupPart).toContain(`public.${name}`);
    for (const fn of FUNCTIONS.slice(1)) expect(groupPart).toContain(`public.${fn.split('(')[0]}(`);
  });
});
