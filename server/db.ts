import crypto from "crypto";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  accessLogs,
  clients,
  credentials,
  importantLinks,
  InsertAccessLog,
  InsertClient,
  InsertCredential,
  InsertImportantLink,
  InsertServer,
  InsertServerPermission,
  InsertUser,
  serverPermissions,
  servers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── DB Connection ────────────────────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  // Prefer NEON_DATABASE_URL (PostgreSQL); fallback to DATABASE_URL only if it's a postgres URL
  const rawUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
  const dbUrl = rawUrl.startsWith("postgresql") || rawUrl.startsWith("postgres") ? rawUrl : null;
  if (!_db && dbUrl) {
    try {
      const client = postgres(dbUrl, {
        ssl: "require",
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");

  await db
    .insert(users)
    .values({
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role,
      lastSignedIn: user.lastSignedIn ?? now,
    })
    .onConflictDoUpdate({
      target: users.openId,
      set: {
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function getClients(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db
      .select()
      .from(clients)
      .where(
        or(
          like(clients.name, `%${search}%`),
          like(clients.contactName, `%${search}%`),
          like(clients.contactEmail, `%${search}%`),
          like(clients.cnpj, `%${search}%`)
        )
      )
      .orderBy(desc(clients.createdAt));
  }
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(clients).values(data).returning({ id: clients.id });
  return result[0];
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(clients).set({ ...data, updatedAt: new Date() }).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(clients).where(eq(clients.id, id));
}

// ─── Servers ──────────────────────────────────────────────────────────────────
export async function getServers(clientId?: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (clientId) conditions.push(eq(servers.clientId, clientId));
  if (search) {
    conditions.push(
      or(
        like(servers.hostname, `%${search}%`),
        like(servers.ipAddress, `%${search}%`),
        like(servers.description, `%${search}%`)
      )
    );
  }
  const query = db.select().from(servers);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(servers.createdAt));
  }
  return query.orderBy(desc(servers.createdAt));
}

export async function getServerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
  return result[0];
}

export async function createServer(data: InsertServer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(servers).values(data).returning({ id: servers.id });
  return result[0];
}

export async function updateServer(id: number, data: Partial<InsertServer>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(servers).set({ ...data, updatedAt: new Date() }).where(eq(servers.id, id));
}

export async function deleteServer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete related records first to avoid FK constraint violations
  await db.delete(serverPermissions).where(eq(serverPermissions.serverId, id));
  await db.delete(credentials).where(eq(credentials.serverId, id));
  await db.delete(accessLogs).where(eq(accessLogs.serverId, id));
  await db.delete(importantLinks).where(eq(importantLinks.serverId, id));
  return db.delete(servers).where(eq(servers.id, id));
}

// ─── Credentials ──────────────────────────────────────────────────────────────
export async function getCredentialsByServer(serverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(credentials).where(eq(credentials.serverId, serverId));
}

export async function getCredentialById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(credentials).where(eq(credentials.id, id)).limit(1);
  return result[0];
}

export async function createCredential(data: InsertCredential) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(credentials).values(data).returning({ id: credentials.id });
  return result[0];
}

export async function updateCredential(id: number, data: Partial<InsertCredential>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(credentials).set({ ...data, updatedAt: new Date() }).where(eq(credentials.id, id));
}

export async function deleteCredential(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(credentials).where(eq(credentials.id, id));
}

// ─── Important Links ──────────────────────────────────────────────────────────
export async function getLinks(clientId?: number, serverId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (clientId) conditions.push(eq(importantLinks.clientId, clientId));
  if (serverId) conditions.push(eq(importantLinks.serverId, serverId));
  if (conditions.length > 0) {
    return db.select().from(importantLinks).where(and(...conditions)).orderBy(desc(importantLinks.createdAt));
  }
  return db.select().from(importantLinks).orderBy(desc(importantLinks.createdAt));
}

export async function createLink(data: InsertImportantLink) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(importantLinks).values(data).returning({ id: importantLinks.id });
  return result[0];
}

export async function updateLink(id: number, data: Partial<InsertImportantLink>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(importantLinks).set(data).where(eq(importantLinks.id, id));
}

export async function deleteLink(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(importantLinks).where(eq(importantLinks.id, id));
}

// ─── Server Permissions ───────────────────────────────────────────────────────
export async function getPermissionsByServer(serverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serverPermissions).where(eq(serverPermissions.serverId, serverId));
}

export async function getPermissionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serverPermissions).where(eq(serverPermissions.userId, userId));
}

export async function upsertPermission(data: InsertServerPermission) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .insert(serverPermissions)
    .values(data)
    .onConflictDoUpdate({
      target: [serverPermissions.userId, serverPermissions.serverId],
      set: {
        canConnect: data.canConnect,
        canViewCredentials: data.canViewCredentials,
        expiresAt: data.expiresAt,
      },
    });
}

export async function deletePermission(userId: number, serverId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .delete(serverPermissions)
    .where(and(eq(serverPermissions.userId, userId), eq(serverPermissions.serverId, serverId)));
}

// ─── Access Logs ──────────────────────────────────────────────────────────────
export async function createAccessLog(data: InsertAccessLog) {
  const db = await getDb();
  if (!db) return;
  return db.insert(accessLogs).values(data);
}

export async function getAccessLogs(limit = 100, serverId?: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (serverId) conditions.push(eq(accessLogs.serverId, serverId));
  if (userId) conditions.push(eq(accessLogs.userId, userId));
  const query = db.select().from(accessLogs);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(accessLogs.createdAt)).limit(limit);
  }
  return query.orderBy(desc(accessLogs.createdAt)).limit(limit);
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalClients: 0, totalServers: 0, onlineServers: 0, recentLogs: [] };

  const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients);
  const [serverCount] = await db.select({ count: sql<number>`count(*)` }).from(servers);
  const [onlineCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(servers)
    .where(eq(servers.status, "online"));

  const recentLogs = await db
    .select()
    .from(accessLogs)
    .orderBy(desc(accessLogs.createdAt))
    .limit(10);

  return {
    totalClients: Number(clientCount?.count ?? 0),
    totalServers: Number(serverCount?.count ?? 0),
    onlineServers: Number(onlineCount?.count ?? 0),
    recentLogs,
  };
}

// ─── FRP Token Management ─────────────────────────────────────────────────────
export async function getOrCreateFrpToken(serverId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const server = await getServerById(serverId);
  if (!server) throw new Error("Server not found");

  if (server.frpToken) return server.frpToken;

  const token = crypto.randomBytes(24).toString("hex");
  await db.update(servers).set({ frpToken: token }).where(eq(servers.id, serverId));
  return token;
}

// ─── User Management (Local Users) ───────────────────────────────────────────
export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      loginMethod: users.loginMethod,
      blocked: users.blocked,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

export async function createLocalUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const openId = `local_${crypto.randomBytes(16).toString("hex")}`;
  const [user] = await db
    .insert(users)
    .values({
      openId,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      loginMethod: "local",
      role: data.role ?? "user",
      blocked: false,
    })
    .returning();
  return user;
}

export async function updateUserPasswordHash(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function toggleUserBlocked(userId: number, blocked: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(users)
    .set({ blocked, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(serverPermissions).where(eq(serverPermissions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}
