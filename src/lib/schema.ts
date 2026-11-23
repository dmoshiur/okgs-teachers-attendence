import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ADMIN_ROLES = ["super_admin", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default(""),
  role: text("role").$type<AdminRole>().notNull().default("admin"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().default(0)
});

export const TEACHER_TYPES = ["teacher", "staff"] as const;
export type TeacherType = (typeof TEACHER_TYPES)[number];

export const teachers = sqliteTable("teachers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  type: text("type").$type<TeacherType>().notNull().default("teacher"),
  designation: text("designation").notNull().default("")
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});

export const assets = sqliteTable("assets", {
  key: text("key").primaryKey(),
  mime: text("mime").notNull(),
  data: blob("data", { mode: "buffer" }).notNull()
});

export type Admin = typeof admins.$inferSelect;
export type Teacher = typeof teachers.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Asset = typeof assets.$inferSelect;
