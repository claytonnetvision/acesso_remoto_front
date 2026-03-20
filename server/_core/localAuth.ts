import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "remote-manager-salt")
    .digest("hex");
}

export function registerLocalAuthRoutes(app: Express) {
  // POST /api/auth/local-login
  app.post("/api/auth/local-login", async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: "Usuário e senha são obrigatórios." });
      return;
    }

    try {
      // Busca usuário por openId = "local-{username}" ou por email
      const openId = `local-${username.toLowerCase()}`;
      let user = await db.getUserByOpenId(openId);

      // Tenta também por email se não encontrou por openId
      if (!user) {
        user = await db.getUserByEmail(username.toLowerCase());
      }

      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Usuário ou senha inválidos." });
        return;
      }

      const expectedHash = hashPassword(password);
      if (user.passwordHash !== expectedHash) {
        res.status(401).json({ error: "Usuário ou senha inválidos." });
        return;
      }

      // Atualiza lastSignedIn
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Cria sessão JWT (mesmo mecanismo do OAuth)
      const sessionToken = await sdk.signSession({
        openId: user.openId,
        appId: "local",
        name: user.name || username,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
        // Em localhost sem HTTPS, precisamos ajustar sameSite
        sameSite: "lax",
        secure: false,
      });

      res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    } catch (error: any) {
      console.error("[LocalAuth] Login failed", error);
      const msg = error?.cause?.code === 'ECONNRESET' || error?.code === 'ECONNRESET'
        ? "Erro de conexão com o banco de dados. Verifique o DATABASE_URL no .env."
        : "Erro interno no servidor.";
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/auth/local-logout
  app.post("/api/auth/local-logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });
}
