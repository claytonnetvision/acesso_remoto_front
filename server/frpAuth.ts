/**
 * FRP Server Plugin - Authentication Handler
 *
 * The frps server calls this endpoint to validate each client connection.
 * This allows each Windows server to have its own unique token.
 *
 * frps config:
 *   [httpPlugins]
 *   name = "auth-plugin"
 *   addr = "https://acesso-remoto-front.onrender.com"
 *   path = "/api/frp/auth"
 *   ops = ["Login"]
 *
 * Reference: https://gofrp.org/docs/features/common/server-plugin/
 */
import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { servers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

interface FrpLoginContent {
  version: string;
  hostname: string;
  os: string;
  arch: string;
  user: {
    user: string;
    metas: Record<string, string>;
    runId: string;
  };
  timestamp: number;
  privilegeKey: string;
}

interface FrpPluginRequest {
  version: string;
  op: string;
  content: FrpLoginContent;
}

export function registerFrpAuthRoute(app: Express) {
  // POST /api/frp/auth — called by frps server plugin on each client login
  app.post("/api/frp/auth", async (req: Request, res: Response) => {
    try {
      const body = req.body as FrpPluginRequest;

      // Only handle Login operations
      if (body.op !== "Login") {
        return res.json({ reject: false, unchange: true });
      }

      const { user, privilegeKey } = body.content;

      // privilegeKey is the token sent by frpc client
      const token = privilegeKey;

      if (!token) {
        console.log("[FRP Auth] Rejected: no token provided");
        return res.json({
          reject: true,
          rejectReason: "No token provided",
        });
      }

      // Look up the server by token in the database
      const db = await getDb();
      if (!db) {
        console.error("[FRP Auth] Database not available");
        return res.json({ reject: false, unchange: true });
      }
      const server = await db
        .select({ id: servers.id, hostname: servers.hostname })
        .from(servers)
        .where(eq(servers.frpToken, token))
        .limit(1);

      if (server.length === 0) {
        console.log(`[FRP Auth] Rejected: unknown token for user=${user.user}`);
        return res.json({
          reject: true,
          rejectReason: "Invalid token",
        });
      }

      console.log(`[FRP Auth] Accepted: server=${server[0].hostname} (id=${server[0].id})`);
      return res.json({ reject: false, unchange: true });
    } catch (err) {
      console.error("[FRP Auth] Error:", err);
      // On error, allow connection to avoid blocking all agents
      return res.json({ reject: false, unchange: true });
    }
  });
}
