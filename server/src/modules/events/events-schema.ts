// server/src/modules/events/events-schema.ts
import { mysqlTable, int, varchar, date } from 'drizzle-orm/mysql-core';

export const events = mysqlTable('events', {
  eventId: int('event_id').autoincrement().primaryKey().notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  promotionalCode: varchar('promotional_code', { length: 15 }),
});

export type Event = typeof events.$inferSelect;