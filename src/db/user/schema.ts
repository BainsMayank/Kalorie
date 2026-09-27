import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * App settings as key/value pairs (SPEC §4.2). `value` holds JSON text,
 * e.g. key "theme", value "\"dark\"".
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
