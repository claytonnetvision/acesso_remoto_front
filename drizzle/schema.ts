import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  serial,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "inactive", "suspended"]);
export const serverStatusEnum = pgEnum("server_status", ["online", "offline", "unknown", "maintenance"]);
export const accessActionEnum = pgEnum("access_action", ["connect", "disconnect", "view_credentials", "create", "update", "delete"]);
export const osTypeEnum = pgEnum("os_type", ["win2008r2", "win2012r2", "win2016plus", "win7", "win10", "win11", "other"]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: text("passwordHash"),
  blocked: boolean("blocked").default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 20 }),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 30 }),
  address: text("address"),
  notes: text("notes"),
  status: clientStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy").references(() => users.id),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Servers ──────────────────────────────────────────────────────────────────
export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull().references(() => clients.id),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  rdpPort: integer("rdpPort").default(3389).notNull(),
  operatingSystem: varchar("operatingSystem", { length: 100 }),
  osType: osTypeEnum("osType").default("win2016plus"),
  description: text("description"),
  notes: text("notes"),
  status: serverStatusEnum("status").default("unknown").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt"),
  frpToken: varchar("frpToken", { length: 64 }),
  frpRemotePort: integer("frpRemotePort"),
  enableMetrics: boolean("enableMetrics").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy").references(() => users.id),
});

export type Server = typeof servers.$inferSelect;
export type InsertServer = typeof servers.$inferInsert;

// ─── Credentials ──────────────────────────────────────────────────────────────
export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  serverId: integer("serverId").notNull().references(() => servers.id),
  label: varchar("label", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  passwordEncrypted: text("passwordEncrypted").notNull(),
  domain: varchar("domain", { length: 255 }),
  notes: text("notes"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy").references(() => users.id),
});

export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = typeof credentials.$inferInsert;

// ─── Important Links ──────────────────────────────────────────────────────────
export const importantLinks = pgTable("important_links", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").references(() => clients.id),
  serverId: integer("serverId").references(() => servers.id),
  title: varchar("title", { length: 255 }).notNull(),
  url: text("url").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: integer("createdBy").references(() => users.id),
});

export type ImportantLink = typeof importantLinks.$inferSelect;
export type InsertImportantLink = typeof importantLinks.$inferInsert;

// ─── Server Permissions ───────────────────────────────────────────────────────
export const serverPermissions = pgTable("server_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  serverId: integer("serverId").notNull().references(() => servers.id),
  canConnect: boolean("canConnect").default(true).notNull(),
  canViewCredentials: boolean("canViewCredentials").default(false).notNull(),
  grantedBy: integer("grantedBy").references(() => users.id),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type ServerPermission = typeof serverPermissions.$inferSelect;
export type InsertServerPermission = typeof serverPermissions.$inferInsert;

// ─── Access Logs ──────────────────────────────────────────────────────────────
export const accessLogs = pgTable("access_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id),
  serverId: integer("serverId").references(() => servers.id),
  clientId: integer("clientId").references(() => clients.id),
  action: accessActionEnum("action").notNull(),
  resourceType: varchar("resourceType", { length: 50 }),
  resourceId: integer("resourceId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  sessionDuration: integer("sessionDuration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AccessLog = typeof accessLogs.$inferSelect;
export type InsertAccessLog = typeof accessLogs.$inferInsert;
//