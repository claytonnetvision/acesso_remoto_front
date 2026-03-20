import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock db module ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    totalClients: 5,
    totalServers: 10,
    onlineServers: 7,
    recentLogs: [],
  }),
  getClients: vi.fn().mockResolvedValue([
    { id: 1, name: "Empresa ABC", status: "active", cnpj: "00.000.000/0001-00", contactName: "João", contactEmail: "joao@abc.com", contactPhone: "11999999999", address: null, notes: null, createdAt: new Date(), updatedAt: new Date(), createdBy: 1 },
  ]),
  getClientById: vi.fn().mockResolvedValue({
    id: 1, name: "Empresa ABC", status: "active",
  }),
  createClient: vi.fn().mockResolvedValue({}),
  updateClient: vi.fn().mockResolvedValue({}),
  deleteClient: vi.fn().mockResolvedValue({}),
  getServers: vi.fn().mockResolvedValue([
    { id: 1, clientId: 1, hostname: "SRV-01", ipAddress: "192.168.1.10", rdpPort: 3389, status: "online", operatingSystem: "Windows Server 2022", description: null, notes: null, createdAt: new Date(), updatedAt: new Date(), createdBy: 1, lastCheckedAt: null },
  ]),
  getServerById: vi.fn().mockResolvedValue({
    id: 1, clientId: 1, hostname: "SRV-01", ipAddress: "192.168.1.10", rdpPort: 3389, status: "online",
  }),
  createServer: vi.fn().mockResolvedValue({}),
  updateServer: vi.fn().mockResolvedValue({}),
  deleteServer: vi.fn().mockResolvedValue({}),
  getCredentialsByServer: vi.fn().mockResolvedValue([
    { id: 1, serverId: 1, label: "Admin", username: "administrator", passwordEncrypted: "abc:def", domain: null, notes: null, isDefault: true, createdAt: new Date(), updatedAt: new Date(), createdBy: 1 },
  ]),
  getCredentialById: vi.fn().mockResolvedValue({
    id: 1, serverId: 1, label: "Admin", username: "administrator", passwordEncrypted: "abc:def", domain: null, isDefault: true,
  }),
  createCredential: vi.fn().mockResolvedValue({}),
  updateCredential: vi.fn().mockResolvedValue({}),
  deleteCredential: vi.fn().mockResolvedValue({}),
  getLinks: vi.fn().mockResolvedValue([]),
  createLink: vi.fn().mockResolvedValue({}),
  updateLink: vi.fn().mockResolvedValue({}),
  deleteLink: vi.fn().mockResolvedValue({}),
  getPermissionsByServer: vi.fn().mockResolvedValue([]),
  getPermissionsByUser: vi.fn().mockResolvedValue([]),
  upsertPermission: vi.fn().mockResolvedValue({}),
  deletePermission: vi.fn().mockResolvedValue({}),
  createAccessLog: vi.fn().mockResolvedValue({}),
  getAccessLogs: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────
function makeCtx(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const { ctx } = { ctx: makeCtx() };
    const clearedCookies: string[] = [];
    ctx.res.clearCookie = (name: string) => { clearedCookies.push(name); };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies).toContain("app_session_id");
  });
});

describe("dashboard.stats", () => {
  it("returns stats for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const stats = await caller.dashboard.stats();
    expect(stats.totalClients).toBe(5);
    expect(stats.totalServers).toBe(10);
    expect(stats.onlineServers).toBe(7);
    expect(Array.isArray(stats.recentLogs)).toBe(true);
  });
});

describe("clients router", () => {
  it("lists clients", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.clients.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.name).toBe("Empresa ABC");
  });

  it("creates a client as admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.clients.create({
      name: "Nova Empresa",
      status: "active",
    });
    expect(result.success).toBe(true);
  });

  it("blocks client creation for non-admin", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.clients.create({ name: "Empresa X", status: "active" })
    ).rejects.toThrow();
  });

  it("updates a client as admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.clients.update({ id: 1, name: "Empresa Atualizada" });
    expect(result.success).toBe(true);
  });

  it("deletes a client as admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.clients.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("servers router", () => {
  it("lists servers", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.servers.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.hostname).toBe("SRV-01");
  });

  it("gets a server by id", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.servers.get({ id: 1 });
    expect(result.hostname).toBe("SRV-01");
    expect(result.ipAddress).toBe("192.168.1.10");
  });

  it("creates a server as admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.servers.create({
      clientId: 1,
      hostname: "SRV-02",
      ipAddress: "192.168.1.20",
      rdpPort: 3389,
    });
    expect(result.success).toBe(true);
  });

  it("blocks server creation for non-admin", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.servers.create({ clientId: 1, hostname: "SRV-X", ipAddress: "10.0.0.1", rdpPort: 3389 })
    ).rejects.toThrow();
  });

  it("updates server status", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.servers.updateStatus({ id: 1, status: "online" });
    expect(result.success).toBe(true);
  });
});

describe("credentials router", () => {
  it("lists credentials for admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.credentials.listByServer({ serverId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.label).toBe("Admin");
    expect(result[0]?.passwordEncrypted).toBe("••••••••"); // masked
  });

  it("blocks credential listing for user without permission", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.credentials.listByServer({ serverId: 1 })
    ).rejects.toThrow();
  });

  it("creates a credential as admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.credentials.create({
      serverId: 1,
      label: "Suporte",
      username: "suporte",
      password: "senha123",
      isDefault: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("links router", () => {
  it("lists links", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.links.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a link as admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.links.create({
      title: "Painel VPN",
      url: "https://vpn.empresa.com",
    });
    expect(result.success).toBe(true);
  });
});

describe("logs router", () => {
  it("lists logs for admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.logs.list({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("users router", () => {
  it("lists users for admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("blocks user listing for non-admin", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("rdp router", () => {
  it("starts an RDP session as admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.rdp.startSession({ serverId: 1 });
    expect(result.hostname).toBe("SRV-01");
    expect(result.ipAddress).toBe("192.168.1.10");
    expect(result.rdpPort).toBe(3389);
    expect(typeof result.sessionToken).toBe("string");
  });

  it("ends an RDP session", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.rdp.endSession({ serverId: 1, duration: 120 });
    expect(result.success).toBe(true);
  });
});
