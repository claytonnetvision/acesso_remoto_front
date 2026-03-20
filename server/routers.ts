import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import crypto from "crypto";
import { frpRouter } from "./routers/frp";

// ─── Encryption helpers ───────────────────────────────────────────────────────
const ENCRYPTION_KEY = process.env.JWT_SECRET?.substring(0, 32).padEnd(32, "0") ?? "remote-access-manager-key-32chr";
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  try {
    const [ivHex, encryptedHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return "";
  }
}

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  }
  return next({ ctx });
});

// ─── Logging helper ───────────────────────────────────────────────────────────
async function logAction(
  userId: number,
  action: "connect" | "disconnect" | "view_credentials" | "create" | "update" | "delete",
  resourceType: string,
  resourceId?: number,
  details?: string,
  serverId?: number,
  clientId?: number
) {
  await db.createAccessLog({
    userId,
    action,
    resourceType,
    resourceId,
    details,
    serverId,
    clientId,
  });
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return db.getDashboardStats();
    }),
  }),

  // ─── Clients ────────────────────────────────────────────────────────────────
  clients: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getClients(input?.search);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        return client;
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          cnpj: z.string().optional(),
          contactName: z.string().optional(),
          contactEmail: z.string().email().optional().or(z.literal("")),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
          notes: z.string().optional(),
          status: z.enum(["active", "inactive", "suspended"]).default("active"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.createClient({ ...input, createdBy: ctx.user.id });
        await logAction(ctx.user.id, "create", "client", undefined, `Cliente criado: ${input.name}`);
        return { success: true };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          cnpj: z.string().optional(),
          contactName: z.string().optional(),
          contactEmail: z.string().email().optional().or(z.literal("")),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
          notes: z.string().optional(),
          status: z.enum(["active", "inactive", "suspended"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateClient(id, data);
        await logAction(ctx.user.id, "update", "client", id, `Cliente atualizado: ${id}`);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteClient(input.id);
        await logAction(ctx.user.id, "delete", "client", input.id, `Cliente removido: ${input.id}`);
        return { success: true };
      }),
  }),

  // ─── Servers ────────────────────────────────────────────────────────────────
  servers: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getServers(input?.clientId, input?.search);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const server = await db.getServerById(input.id);
        if (!server) throw new TRPCError({ code: "NOT_FOUND", message: "Servidor não encontrado." });
        return server;
      }),

    create: adminProcedure
      .input(
        z.object({
          clientId: z.number(),
          hostname: z.string().min(1),
          ipAddress: z.string().min(1),
          rdpPort: z.number().default(3389),
          osType: z.enum(["win2008r2", "win2012r2", "win2016plus", "win7", "win10", "win11", "other"]).default("win2016plus"),
          operatingSystem: z.string().optional(),
          description: z.string().optional(),
          notes: z.string().optional(),
          enableMetrics: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.createServer({ ...input, createdBy: ctx.user.id });
        await logAction(ctx.user.id, "create", "server", undefined, `Servidor criado: ${input.hostname}`, undefined, input.clientId);
        return { success: true };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          hostname: z.string().min(1).optional(),
          ipAddress: z.string().min(1).optional(),
          rdpPort: z.number().optional(),
          osType: z.enum(["win2008r2", "win2012r2", "win2016plus", "win7", "win10", "win11", "other"]).optional(),
          operatingSystem: z.string().optional(),
          description: z.string().optional(),
          notes: z.string().optional(),
          status: z.enum(["online", "offline", "unknown", "maintenance"]).optional(),
          enableMetrics: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateServer(id, data);
        await logAction(ctx.user.id, "update", "server", id, `Servidor atualizado: ${id}`);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteServer(input.id);
        await logAction(ctx.user.id, "delete", "server", input.id, `Servidor removido: ${input.id}`);
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["online", "offline", "unknown", "maintenance"]) }))
      .mutation(async ({ input }) => {
        await db.updateServer(input.id, { status: input.status, lastCheckedAt: new Date() });
        return { success: true };
      }),
  }),

  // ─── Credentials ────────────────────────────────────────────────────────────
  credentials: router({
    listByServer: protectedProcedure
      .input(z.object({ serverId: z.number() }))
      .query(async ({ input, ctx }) => {
        // Check permission
        if (ctx.user.role !== "admin") {
          const perms = await db.getPermissionsByUser(ctx.user.id);
          const hasPerm = perms.some((p) => p.serverId === input.serverId && p.canViewCredentials);
          if (!hasPerm) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para ver credenciais." });
        }
        const creds = await db.getCredentialsByServer(input.serverId);
        // Return without decrypted password by default
        return creds.map((c) => ({ ...c, passwordEncrypted: "••••••••" }));
      }),

    reveal: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const cred = await db.getCredentialById(input.id);
        if (!cred) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin") {
          const perms = await db.getPermissionsByUser(ctx.user.id);
          const hasPerm = perms.some((p) => p.serverId === cred.serverId && p.canViewCredentials);
          if (!hasPerm) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para ver credenciais." });
        }
        await logAction(ctx.user.id, "view_credentials", "credential", input.id, `Credencial revelada: ${cred.label}`, cred.serverId);
        return { ...cred, password: decrypt(cred.passwordEncrypted) };
      }),

    create: adminProcedure
      .input(
        z.object({
          serverId: z.number(),
          label: z.string().min(1),
          username: z.string().min(1),
          password: z.string().min(1),
          domain: z.string().optional(),
          notes: z.string().optional(),
          isDefault: z.boolean().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { password, ...rest } = input;
        await db.createCredential({
          ...rest,
          passwordEncrypted: encrypt(password),
          createdBy: ctx.user.id,
        });
        await logAction(ctx.user.id, "create", "credential", undefined, `Credencial criada: ${input.label}`, input.serverId);
        return { success: true };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          label: z.string().optional(),
          username: z.string().optional(),
          password: z.string().optional(),
          domain: z.string().optional(),
          notes: z.string().optional(),
          isDefault: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, password, ...rest } = input;
        const updateData: Record<string, unknown> = { ...rest };
        if (password) updateData.passwordEncrypted = encrypt(password);
        await db.updateCredential(id, updateData as Parameters<typeof db.updateCredential>[1]);
        await logAction(ctx.user.id, "update", "credential", id, `Credencial atualizada: ${id}`);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCredential(input.id);
        await logAction(ctx.user.id, "delete", "credential", input.id, `Credencial removida: ${input.id}`);
        return { success: true };
      }),
  }),

  // ─── Links ───────────────────────────────────────────────────────────────────
  links: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), serverId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getLinks(input?.clientId, input?.serverId);
      }),

    create: adminProcedure
      .input(
        z.object({
          clientId: z.number().optional(),
          serverId: z.number().optional(),
          title: z.string().min(1),
          url: z.string().url(),
          description: z.string().optional(),
          category: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.createLink({ ...input, createdBy: ctx.user.id });
        return { success: true };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          url: z.string().url().optional(),
          description: z.string().optional(),
          category: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateLink(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLink(input.id);
        return { success: true };
      }),
  }),

  // ─── Permissions ─────────────────────────────────────────────────────────────
  permissions: router({
    listByServer: adminProcedure
      .input(z.object({ serverId: z.number() }))
      .query(async ({ input }) => {
        return db.getPermissionsByServer(input.serverId);
      }),

    listByUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getPermissionsByUser(input.userId);
      }),

    myPermissions: protectedProcedure.query(async ({ ctx }) => {
      return db.getPermissionsByUser(ctx.user.id);
    }),

    grant: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          serverId: z.number(),
          canConnect: z.boolean().default(true),
          canViewCredentials: z.boolean().default(false),
          expiresAt: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.upsertPermission({ ...input, grantedBy: ctx.user.id });
        await logAction(ctx.user.id, "create", "permission", undefined, `Permissão concedida: user=${input.userId} server=${input.serverId}`);
        return { success: true };
      }),

    revoke: adminProcedure
      .input(z.object({ userId: z.number(), serverId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deletePermission(input.userId, input.serverId);
        await logAction(ctx.user.id, "delete", "permission", undefined, `Permissão revogada: user=${input.userId} server=${input.serverId}`);
        return { success: true };
      }),
  }),

  // ─── Access Logs ─────────────────────────────────────────────────────────────
  logs: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().default(100),
          serverId: z.number().optional(),
          userId: z.number().optional(),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          return db.getAccessLogs(input?.limit ?? 50, undefined, ctx.user.id);
        }
        return db.getAccessLogs(input?.limit ?? 100, input?.serverId, input?.userId);
      }),
  }),

  // ─── Users ───────────────────────────────────────────────────────────────────
  users: router({
    // Listar todos os usuários (admin)
    list: adminProcedure.query(async () => {
      return db.listUsers();
    }),
    // Criar usuário local (admin)
    create: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["user", "admin"]).default("user"),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado." });
        const passwordHash = crypto.createHash("sha256").update(input.password + "remote-manager-salt").digest("hex");
        const user = await db.createLocalUser({ name: input.name, email: input.email, passwordHash, role: input.role });
        await logAction(ctx.user.id, "create", "server", undefined, `Usuário criado: ${input.email}`);
        return { success: true, userId: user.id };
      }),
    // Trocar senha (admin pode trocar de qualquer um; usuário só a própria)
    setPassword: protectedProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(6),
        currentPassword: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ctx.user.role === "admin";
        const isSelf = ctx.user.id === input.userId;
        if (!isAdmin && !isSelf) throw new TRPCError({ code: "FORBIDDEN" });
        if (isSelf && !isAdmin) {
          const user = await db.getUserById(input.userId);
          if (!user) throw new TRPCError({ code: "NOT_FOUND" });
          if (user.passwordHash) {
            const currentHash = crypto.createHash("sha256").update((input.currentPassword ?? "") + "remote-manager-salt").digest("hex");
            if (currentHash !== user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
          }
        }
        const passwordHash = crypto.createHash("sha256").update(input.newPassword + "remote-manager-salt").digest("hex");
        await db.updateUserPasswordHash(input.userId, passwordHash);
        return { success: true };
      }),
    // Bloquear/desbloquear usuário (admin)
    toggleBlock: adminProcedure
      .input(z.object({ userId: z.number(), blocked: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode bloquear a si mesmo." });
        await db.toggleUserBlocked(input.userId, input.blocked);
        await logAction(ctx.user.id, "update", "server", undefined, `Usuário ${input.blocked ? "bloqueado" : "desbloqueado"}: ID ${input.userId}`);
        return { success: true };
      }),
    // Excluir usuário (admin)
    delete: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir a si mesmo." });
        await db.deleteUser(input.userId);
        return { success: true };
      }),
    // Perfil do usuário logado
    me: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        loginMethod: user.loginMethod,
        blocked: user.blocked,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
      };
    }),
  }),

  // ─── RDP Session ─────────────────────────────────────────────────────────────
  rdp: router({
    startSession: protectedProcedure
      .input(z.object({ serverId: z.number(), credentialId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const server = await db.getServerById(input.serverId);
        if (!server) throw new TRPCError({ code: "NOT_FOUND", message: "Servidor não encontrado." });

        // Check permission
        if (ctx.user.role !== "admin") {
          const perms = await db.getPermissionsByUser(ctx.user.id);
          const hasPerm = perms.some((p) => p.serverId === input.serverId && p.canConnect);
          if (!hasPerm) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para conectar neste servidor." });
        }

        // Get credential
        let credential = null;
        if (input.credentialId) {
          credential = await db.getCredentialById(input.credentialId);
        } else {
          const creds = await db.getCredentialsByServer(input.serverId);
          credential = creds.find((c) => c.isDefault) ?? creds[0] ?? null;
        }

        await logAction(ctx.user.id, "connect", "server", server.id, `Sessão RDP iniciada: ${server.hostname}`, server.id, server.clientId);

        return {
          serverId: server.id,
          hostname: server.hostname,
          ipAddress: server.ipAddress,
          rdpPort: server.rdpPort,
          username: credential?.username ?? "",
          password: credential ? decrypt(credential.passwordEncrypted) : "",
          domain: credential?.domain ?? "",
          sessionToken: Buffer.from(JSON.stringify({
            serverId: server.id,
            userId: ctx.user.id,
            ts: Date.now(),
          })).toString("base64"),
        };
      }),

    endSession: protectedProcedure
      .input(z.object({ serverId: z.number(), duration: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const server = await db.getServerById(input.serverId);
        await db.createAccessLog({
          userId: ctx.user.id,
          serverId: input.serverId,
          clientId: server?.clientId,
          action: "disconnect",
          resourceType: "server",
          resourceId: input.serverId,
          details: `Sessão RDP encerrada: ${server?.hostname}`,
          sessionDuration: input.duration,
        });
        return { success: true };
      }),
  }),
  frp: frpRouter,
});
export type AppRouter = typeof appRouter;
