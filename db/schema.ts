import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  day: text("day").notNull(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_tasks_owner_day").on(table.ownerId, table.day),
  index("idx_tasks_owner_open").on(table.ownerId, table.completed, table.day),
]);
