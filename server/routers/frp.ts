/**
 * FRP (Fast Reverse Proxy) Router
 *
 * Manages tunnel configuration for each server agent.
 * Each Windows server gets a unique frpc.toml + install script.
 *
 * Architecture:
 *   [Windows Agent (frpc)] → [frps on this server] → [Manager Web UI]
 *
 * The frps server runs on port 7000 (TCP tunnel) and 7500 (dashboard API).
 * Each server gets a unique token and a dedicated remote port for RDP.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import crypto from "crypto";

// ─── Port allocation ──────────────────────────────────────────────────────────
// RDP tunnels are allocated in range 20000-29999
const RDP_PORT_BASE = 20000;
const RDP_PORT_MAX  = 29999;

function allocateRdpPort(serverId: number): number {
  // Deterministic port from serverId (wraps within range)
  return RDP_PORT_BASE + (serverId % (RDP_PORT_MAX - RDP_PORT_BASE));
}

// ─── Config generators ────────────────────────────────────────────────────────

function generateFrpcToml(opts: {
  serverAddr: string;
  serverPort: number;
  protocol: string;
  token: string;
  serverName: string;
  serverId: number;
  rdpLocalPort: number;
  rdpRemotePort: number;
}): string {
  const proxyName = `rdp-${opts.serverId}-${opts.serverName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
  // wss usa porta 443 e conecta via WebSocket Secure (para Render/Cloudflare)
  // websocket usa a porta normal sem TLS
  // tcp é o padrão para VPS com porta aberta
  const protocolLine = opts.protocol !== "tcp" ? `transport.protocol = "${opts.protocol}"` : "# transport.protocol = \"tcp\" (default)";
  return `# frpc.toml — Remote Access Manager Agent
# Server: ${opts.serverName} (ID: ${opts.serverId})
# Generated automatically — do not edit manually

serverAddr = "${opts.serverAddr}"
serverPort = ${opts.serverPort}
auth.method = "token"
auth.token = "${opts.token}"

# Transport protocol: ${opts.protocol}
${protocolLine}

# Heartbeat to keep tunnel alive
transport.heartbeatInterval = 30
transport.heartbeatTimeout = 90

# Log
log.level = "info"
log.maxDays = 3

# ── RDP Tunnel ────────────────────────────────────────────────────────────────────────────
[[proxies]]
name = "${proxyName}"
type = "tcp"
localIP = "127.0.0.1"
localPort = ${opts.rdpLocalPort}
remotePort = ${opts.rdpRemotePort}
`;
}

function generateFrpcIni(opts: {
  serverAddr: string;
  serverPort: number;
  token: string;
  serverName: string;
  serverId: number;
  rdpLocalPort: number;
  rdpRemotePort: number;
}): string {
  // INI format for frpc v0.51.x (compatible with Windows Server 2008 R2 / 2012 R2)
  const proxyName = `rdp-${opts.serverId}-${opts.serverName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
  return `; frpc.ini — Remote Access Manager Agent (Legacy Format)
; Server: ${opts.serverName} (ID: ${opts.serverId})
; Generated automatically — do not edit manually
; Compatible with frpc v0.51.x (Windows Server 2008 R2 / 2012 R2)

[common]
server_addr = ${opts.serverAddr}
server_port = ${opts.serverPort}
token = ${opts.token}
log_level = info
log_max_days = 3
heartbeat_interval = 30
heartbeat_timeout = 90

[${proxyName}]
type = tcp
local_ip = 127.0.0.1
local_port = ${opts.rdpLocalPort}
remote_port = ${opts.rdpRemotePort}
`;
}

function generateInstallBat(opts: {
  serverName: string;
  serverId: number;
}): string {
  return `@echo off
:: ============================================================
:: Remote Access Manager - Agent Installer
:: Server: ${opts.serverName} (ID: ${opts.serverId})
:: Compatible with Windows Server 2008 R2 and later (32/64-bit)
:: ============================================================
:: Run this script as Administrator!

setlocal enabledelayedexpansion

set SERVICE_NAME=RemoteAccessAgent
set SERVICE_DIR=C:\\RemoteAccessAgent
set FRPC_EXE=C:\\RemoteAccessAgent\\frpc.exe
set FRPC_CFG=C:\\RemoteAccessAgent\\frpc.toml
set NSSM_EXE=C:\\RemoteAccessAgent\\nssm.exe
set NSSM_URL=http://31.97.16.12/nssm.exe
set FRPC_LEGACY_URL=http://31.97.16.12/frpc-legacy.exe

echo.
echo  ============================================================
echo   Remote Access Manager - Agent Installer
echo   Server: ${opts.serverName}
echo  ============================================================
echo.

:: Check admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

:: Create directory
echo [1/7] Creating installation directory...
if not exist "%SERVICE_DIR%" mkdir "%SERVICE_DIR%"

:: Copy frpc.toml (will be overridden for legacy OS)
echo [2/7] Copying configuration...
copy /Y "%~dp0frpc.toml" "%FRPC_CFG%" >nul 2>&1

:: Detect Windows version and use correct frpc binary + config
echo [3/7] Detecting Windows version...
for /f "tokens=4-5 delims=[.] " %%i in ('ver') do set VERSION=%%i.%%j
set WIN_MAJOR=0
for /f "tokens=1 delims=." %%i in ("%VERSION%") do set WIN_MAJOR=%%i

:: Windows 6.1 = Server 2008 R2 / Win7
:: Windows 6.2 = Server 2012 / Win8
:: Windows 6.3 = Server 2012 R2 / Win8.1
:: Windows 10.0 = Server 2016+ / Win10+
if "%WIN_MAJOR%" == "10" (
    echo  Windows 10/Server 2016+ detected - using modern frpc with TOML config...
    copy /Y "%~dp0frpc.exe" "%FRPC_EXE%" >nul 2>&1
    if not exist "!FRPC_EXE!" (
        echo  frpc.exe not in package, downloading modern version...
        certutil -urlcache -split -f "http://31.97.16.12/frpc.exe" "!FRPC_EXE!" >nul 2>&1
    )
    set FRPC_CFG=C:\\RemoteAccessAgent\\frpc.toml
    copy /Y "%~dp0frpc.toml" "!FRPC_CFG!" >nul 2>&1
) else (
    echo  Windows Server 2008 R2 / 2012 R2 detected - using legacy frpc v0.51.3 with INI config...
    certutil -urlcache -split -f "!FRPC_LEGACY_URL!" "!FRPC_EXE!" >nul 2>&1
    if not exist "!FRPC_EXE!" (
        echo [ERROR] Failed to download legacy frpc. Check internet connection.
        pause
        exit /b 1
    )
    echo  Legacy frpc downloaded successfully.
    set FRPC_CFG=C:\\RemoteAccessAgent\\frpc.ini
    copy /Y "%~dp0frpc.ini" "!FRPC_CFG!" >nul 2>&1
    if not exist "!FRPC_CFG!" (
        echo [ERROR] frpc.ini not found in package!
        pause
        exit /b 1
    )
    echo  Legacy INI config copied.
)

:: Download NSSM if not present
echo [4/7] Checking NSSM service manager...
if exist "%~dp0nssm.exe" (
    echo  Found nssm.exe in package, copying...
    copy /Y "%~dp0nssm.exe" "%NSSM_EXE%" >nul
) else if not exist "%NSSM_EXE%" (
    echo  Downloading NSSM from management server...
    certutil -urlcache -split -f "%NSSM_URL%" "%NSSM_EXE%" >nul 2>&1
    if not exist "%NSSM_EXE%" (
        echo [ERROR] Failed to download NSSM. Check internet connection.
        echo  Try manually: certutil -urlcache -split -f %NSSM_URL% %NSSM_EXE%
        pause
        exit /b 1
    )
    echo  NSSM downloaded successfully.
)

:: Remove existing service if present
echo [5/7] Removing previous service (if any)...
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    "%NSSM_EXE%" stop "%SERVICE_NAME%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    "%NSSM_EXE%" remove "%SERVICE_NAME%" confirm >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Install as Windows Service using NSSM
echo [6/7] Installing Windows Service (NSSM)...
echo  Using config: !FRPC_CFG!
"%NSSM_EXE%" install "%SERVICE_NAME%" "%FRPC_EXE%" "-c !FRPC_CFG!"
if %errorLevel% neq 0 (
    echo [ERROR] Failed to create service!
    echo Make sure you are running as Administrator.
    pause
    exit /b 1
)

"%NSSM_EXE%" set "%SERVICE_NAME%" DisplayName "Remote Access Manager Agent" >nul
"%NSSM_EXE%" set "%SERVICE_NAME%" Description "Maintains secure tunnel to Remote Access Manager server" >nul
"%NSSM_EXE%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START >nul
"%NSSM_EXE%" set "%SERVICE_NAME%" AppRestartDelay 5000 >nul
"%NSSM_EXE%" set "%SERVICE_NAME%" AppStdout "%SERVICE_DIR%\\frpc.log" >nul
"%NSSM_EXE%" set "%SERVICE_NAME%" AppStderr "%SERVICE_DIR%\\frpc-error.log" >nul

:: Start service
echo [7/7] Starting service...
"%NSSM_EXE%" start "%SERVICE_NAME%"

timeout /t 5 /nobreak >nul

:: Verify
sc query "%SERVICE_NAME%" | find "RUNNING" >nul
if %errorLevel% equ 0 (
    echo.
    echo  [OK] Agent installed and running successfully!
    echo  The server should appear ONLINE in the manager within 30 seconds.
    echo.
) else (
    echo.
    echo  [WARNING] Service may not have started. Trying once more...
    "%NSSM_EXE%" start "%SERVICE_NAME%" >nul 2>&1
    timeout /t 5 /nobreak >nul
    sc query "%SERVICE_NAME%" | find "RUNNING" >nul
    if %errorLevel% equ 0 (
        echo  [OK] Agent started successfully!
    ) else (
        echo  [ERROR] Service failed to start. Check logs:
        echo  %SERVICE_DIR%\\frpc-error.log
    )
    echo.
)

echo  Installation folder: C:\\RemoteAccessAgent
echo  To uninstall: run uninstall.bat as Administrator
echo.
pause
`;
}

function generateUninstallBat(): string {
  return `@echo off
:: Remote Access Manager - Agent Uninstaller
:: Run as Administrator!

set SERVICE_NAME=RemoteAccessAgent
set SERVICE_DIR=%ProgramFiles%\\RemoteAccessAgent

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Run as Administrator!
    pause
    exit /b 1
)

echo Stopping and removing Remote Access Manager Agent...

sc stop "%SERVICE_NAME%" >nul 2>&1
timeout /t 3 /nobreak >nul
sc delete "%SERVICE_NAME%" >nul 2>&1

if exist "%SERVICE_DIR%" (
    timeout /t 2 /nobreak >nul
    rmdir /s /q "%SERVICE_DIR%"
)

echo [OK] Agent removed successfully.
pause
`;
}

function generateReadme(opts: {
  serverName: string;
  serverId: number;
  serverAddr: string;
  rdpRemotePort: number;
}): string {
  return `# Remote Access Manager — Agent
## Server: ${opts.serverName} (ID: ${opts.serverId})

## Contents
- frpc.exe        — FRP client (tunnel agent)
- frpc.toml       — Configuration (pre-configured for this server)
- install.bat     — Installer (run as Administrator)
- uninstall.bat   — Uninstaller (run as Administrator)

## Installation

1. Extract all files to a folder
2. Right-click install.bat → "Run as administrator"
3. Wait for "Agent installed and running successfully!"
4. The server will appear ONLINE in the manager within 30 seconds

## Requirements
- Windows Server 2012 R2 or later (or Windows 10+)
- Administrator privileges for installation
- Outbound internet access on port ${opts.serverAddr.includes(":") ? opts.serverAddr.split(":")[1] : 7000} (TCP)
- No inbound firewall rules needed

## How it works
The agent creates a secure outbound tunnel to the manager server.
RDP (port 3389) is forwarded through the tunnel to remote port ${opts.rdpRemotePort}.
No inbound ports need to be opened on the client's firewall.

## Troubleshooting
- Check service status: sc query RemoteAccessAgent
- View logs: %ProgramFiles%\\RemoteAccessAgent\\frpc.log
- Restart service: sc stop RemoteAccessAgent && sc start RemoteAccessAgent
`;
}

// ─── FRP Router ───────────────────────────────────────────────────────────────
export const frpRouter = router({

  /**
   * Get the frp server configuration for the current deployment.
   * Returns the public address and port that agents should connect to.
   */
  getServerConfig: protectedProcedure.query(async () => {
    const serverAddr = process.env.FRP_SERVER_ADDR ?? process.env.RENDER_EXTERNAL_HOSTNAME ?? "localhost";
    const serverPort = parseInt(process.env.FRP_SERVER_PORT ?? "7000");
    const protocol = process.env.FRP_SERVER_PROTOCOL ?? "tcp";
    const dashboardPort = parseInt(process.env.FRP_DASHBOARD_PORT ?? "7500");
    return { serverAddr, serverPort, protocol, dashboardPort };
  }),

  /**
   * Generate the agent package configuration for a specific server.
   * Returns frpc.toml content + install scripts as strings.
   */
  generateAgentConfig: protectedProcedure
    .input(z.object({ serverId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const server = await db.getServerById(input.serverId);
      if (!server) throw new TRPCError({ code: "NOT_FOUND", message: "Servidor não encontrado." });

      // Admin or user with connect permission
      if (ctx.user.role !== "admin") {
        const perms = await db.getPermissionsByUser(ctx.user.id);
        const hasPerm = perms.some((p) => p.serverId === input.serverId && p.canConnect);
        if (!hasPerm) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const serverAddr = process.env.FRP_SERVER_ADDR ?? process.env.RENDER_EXTERNAL_HOSTNAME ?? "your-server.com";
      const serverPort = parseInt(process.env.FRP_SERVER_PORT ?? "7000");
      const protocol = process.env.FRP_SERVER_PROTOCOL ?? "tcp"; // "tcp" | "websocket" | "wss"
      const rdpRemotePort = allocateRdpPort(server.id);

      // Generate or retrieve the server's frp token
      const token = await db.getOrCreateFrpToken(server.id);

      const frpcToml = generateFrpcToml({
        serverAddr,
        serverPort,
        protocol,
        token,
        serverName: server.hostname,
        serverId: server.id,
        rdpLocalPort: server.rdpPort,
        rdpRemotePort,
      });

      // Legacy INI format for frpc v0.51.x (Windows Server 2008 R2 / 2012 R2)
      const frpcIni = generateFrpcIni({
        serverAddr,
        serverPort,
        token,
        serverName: server.hostname,
        serverId: server.id,
        rdpLocalPort: server.rdpPort,
        rdpRemotePort,
      });

      const installBat = generateInstallBat({
        serverName: server.hostname,
        serverId: server.id,
      });

      const uninstallBat = generateUninstallBat();

      const readme = generateReadme({
        serverName: server.hostname,
        serverId: server.id,
        serverAddr,
        rdpRemotePort,
      });

      // Log the action
      await db.createAccessLog({
        userId: ctx.user.id,
        serverId: server.id,
        clientId: server.clientId,
        action: "create",
        resourceType: "agent_config",
        resourceId: server.id,
        details: `Pacote de agente gerado para: ${server.hostname}`,
      });

      return {
        serverId: server.id,
        hostname: server.hostname,
        rdpRemotePort,
        serverAddr,
        serverPort,
        frpcToml,
        frpcIni,
        installBat,
        uninstallBat,
        readme,
        frpcDownloadUrl: "https://github.com/fatedier/frp/releases/latest/download/frp_0.61.1_windows_amd64.zip",
      };
    }),

  /**
   * Check if a server's tunnel is active by querying the frps dashboard API.
   */
  checkTunnelStatus: protectedProcedure
    .input(z.object({ serverId: z.number() }))
    .query(async ({ input }) => {
      const server = await db.getServerById(input.serverId);
      if (!server) throw new TRPCError({ code: "NOT_FOUND" });

      const rdpRemotePort = allocateRdpPort(server.id);

      try {
        const dashboardAddr = process.env.FRP_DASHBOARD_ADDR ?? "127.0.0.1";
        const dashboardPort = parseInt(process.env.FRP_DASHBOARD_PORT ?? "7500");
        const dashUser = process.env.FRP_DASHBOARD_USER ?? "admin";
        const dashPass = process.env.FRP_DASHBOARD_PASS ?? "admin";

        const auth = Buffer.from(`${dashUser}:${dashPass}`).toString("base64");
        const response = await fetch(
          `http://${dashboardAddr}:${dashboardPort}/api/proxy/tcp`,
          {
            headers: { Authorization: `Basic ${auth}` },
            signal: AbortSignal.timeout(3000),
          }
        );

        if (!response.ok) return { online: false, rdpRemotePort };

        const data = await response.json() as { proxies?: Array<{ status: string; conf?: { remotePort?: number } }> };
        const proxies = data.proxies ?? [];
        const isOnline = proxies.some(
          (p) => p.conf?.remotePort === rdpRemotePort && p.status === "online"
        );

        // Update server status in DB
        await db.updateServer(server.id, {
          status: isOnline ? "online" : "offline",
          lastCheckedAt: new Date(),
        });

        return { online: isOnline, rdpRemotePort };
      } catch {
        return { online: false, rdpRemotePort };
      }
    }),

  /**
   * Bulk check all servers' tunnel status.
   */
  checkAllTunnels: protectedProcedure.mutation(async () => {
    try {
      const dashboardAddr = process.env.FRP_DASHBOARD_ADDR ?? "127.0.0.1";
      const dashboardPort = parseInt(process.env.FRP_DASHBOARD_PORT ?? "7500");
      const dashUser = process.env.FRP_DASHBOARD_USER ?? "admin";
      const dashPass = process.env.FRP_DASHBOARD_PASS ?? "admin";

      const auth = Buffer.from(`${dashUser}:${dashPass}`).toString("base64");
      const response = await fetch(
        `http://${dashboardAddr}:${dashboardPort}/api/proxy/tcp`,
        {
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) return { updated: 0, frpsOnline: false };

      const data = await response.json() as { proxies?: Array<{ status: string; conf?: { remotePort?: number } }> };
      const proxies = data.proxies ?? [];
      const onlinePorts = new Set(
        proxies
          .filter((p) => p.status === "online" && p.conf?.remotePort)
          .map((p) => p.conf!.remotePort!)
      );

      const allServers = await db.getServers();
      let updated = 0;

      for (const server of allServers) {
        const rdpRemotePort = allocateRdpPort(server.id);
        const isOnline = onlinePorts.has(rdpRemotePort);
        const newStatus = isOnline ? "online" : "offline";
        if (server.status !== newStatus) {
          await db.updateServer(server.id, { status: newStatus, lastCheckedAt: new Date() });
          updated++;
        }
      }

      return { updated, frpsOnline: true };
    } catch {
      return { updated: 0, frpsOnline: false };
    }
  }),

  /**
   * Get the RDP connection details for a server via tunnel.
   * Returns the local proxy address to connect via RDP client.
   */
  getRdpConnectionInfo: protectedProcedure
    .input(z.object({ serverId: z.number() }))
    .query(async ({ input, ctx }) => {
      const server = await db.getServerById(input.serverId);
      if (!server) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user.role !== "admin") {
        const perms = await db.getPermissionsByUser(ctx.user.id);
        const hasPerm = perms.some((p) => p.serverId === input.serverId && p.canConnect);
        if (!hasPerm) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const serverAddr = process.env.FRP_SERVER_ADDR ?? process.env.RENDER_EXTERNAL_HOSTNAME ?? "your-server.com";
      const rdpRemotePort = allocateRdpPort(server.id);

      return {
        serverId: server.id,
        hostname: server.hostname,
        tunnelHost: serverAddr,
        tunnelPort: rdpRemotePort,
        directHost: server.ipAddress,
        directPort: server.rdpPort,
      };
    }),
});
