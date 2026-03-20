/**
 * FRP (Fast Reverse Proxy) Router
 *
 * Manages tunnel configuration for each server agent.
 * Each Windows server gets a unique frpc.toml + install script.
 *
 * Architecture:
 *   [Windows Agent (frpc)] → [frps on this server] → [Manager Web UI]
 *
 * frps modern  v0.61.1 → port 7000 (WS2016+, Win10/11)
 * frps legacy  v0.51.3 → port 7001 (WS2008 R2, WS2012 R2, Win7)
 * Dashboard               port 7500
 * RDP tunnels             ports 20000-29999
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

// ─── Port allocation ──────────────────────────────────────────────────────────
// RDP tunnels are allocated in range 20000-29999
const RDP_PORT_BASE = 20000;
const RDP_PORT_MAX  = 29999;

function allocateRdpPort(serverId: number): number {
  // Deterministic port from serverId (wraps within range)
  return RDP_PORT_BASE + (serverId % (RDP_PORT_MAX - RDP_PORT_BASE));
}

// Metrics tunnels are allocated in range 21000-21999
const METRICS_PORT_BASE = 21000;
const METRICS_PORT_MAX  = 21999;
const METRICS_LOCAL_PORT = 9182; // PowerShell HTTP metrics agent local port

function allocateMetricsPort(serverId: number): number {
  return METRICS_PORT_BASE + (serverId % (METRICS_PORT_MAX - METRICS_PORT_BASE));
}

// ─── OS classification ────────────────────────────────────────────────────────
// Legacy OS: WS2008 R2, WS2012 R2, Win7 → frpc v0.51.3, port 7001, INI config
// Modern OS: WS2016+, Win10/11 → frpc v0.61.1, port 7000, TOML config
const LEGACY_OS_TYPES = ["win2008r2", "win2012r2", "win7"] as const;

function isLegacyOsType(osType: string | null | undefined): boolean {
  return LEGACY_OS_TYPES.includes((osType ?? "win2016plus") as typeof LEGACY_OS_TYPES[number]);
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
  metricsRemotePort: number;
}): string {
  const proxyName = `rdp-${opts.serverId}-${opts.serverName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
  const metricsProxyName = `metrics-${opts.serverId}-${opts.serverName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
  const protocolLine = opts.protocol !== "tcp" ? `transport.protocol = "${opts.protocol}"` : "# transport.protocol = \"tcp\" (default)";
  return `# frpc.toml — Remote Access Manager Agent
# Server: ${opts.serverName} (ID: ${opts.serverId})
# Generated automatically — do not edit manually
# Compatible with frpc v0.61.1+ (Windows Server 2016+, Windows 10/11)

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

# ── Metrics Tunnel (CPU/RAM/Disk monitoring) ──────────────────────────────────────────────
[[proxies]]
name = "${metricsProxyName}"
type = "tcp"
localIP = "127.0.0.1"
localPort = ${METRICS_LOCAL_PORT}
remotePort = ${opts.metricsRemotePort}
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
  metricsRemotePort: number;
}): string {
  // INI format for frpc v0.51.x (compatible with Windows Server 2008 R2 / 2012 R2)
  const proxyName = `rdp-${opts.serverId}-${opts.serverName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
  const metricsProxyName = `metrics-${opts.serverId}-${opts.serverName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
  return `; frpc.ini — Remote Access Manager Agent (Legacy Format)
; Server: ${opts.serverName} (ID: ${opts.serverId})
; Generated automatically — do not edit manually
; Compatible with frpc v0.51.x (Windows Server 2008 R2 / 2012 R2 / Win7)

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

[${metricsProxyName}]
type = tcp
local_ip = 127.0.0.1
local_port = ${METRICS_LOCAL_PORT}
remote_port = ${opts.metricsRemotePort}
`;
}

function generateInstallBatModern(opts: {
  serverName: string;
  serverId: number;
}): string {
  return `@echo off
:: ============================================================
:: Remote Access Manager - Agent Installer (Modern)
:: Server: ${opts.serverName} (ID: ${opts.serverId})
:: Compatible with Windows Server 2016+ / Windows 10 / Windows 11
:: Installs: frpc tunnel agent + metrics monitoring agent
:: ============================================================
:: Run this script as Administrator!

setlocal enabledelayedexpansion

set SERVICE_NAME=RemoteAccessAgent
set METRICS_SERVICE_NAME=RemoteAccessMetrics
set SERVICE_DIR=C:\\RemoteAccessAgent
set FRPC_EXE=C:\\RemoteAccessAgent\\frpc.exe
set FRPC_CFG=C:\\RemoteAccessAgent\\frpc.toml
set METRICS_PS1=C:\\RemoteAccessAgent\\metrics-agent.ps1
set METRICS_XML=C:\\RemoteAccessAgent\\metrics-winsw.xml
set WINSW_EXE=C:\\RemoteAccessAgent\\winsw.exe
set WINSW_XML=C:\\RemoteAccessAgent\\winsw.xml
set METRICS_WINSW_EXE=C:\\RemoteAccessAgent\\metrics-winsw.exe
set WINSW_URL=http://31.97.16.12/winsw.exe
set METRICS_PS1_URL=http://31.97.16.12/metrics-agent.ps1

echo.
echo  ============================================================
echo   Remote Access Manager - Agent Installer
echo   Server: ${opts.serverName}
echo   Mode: Modern (frpc v0.61.1 + TOML config + Metrics)
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
echo [1/8] Creating installation directory...
if not exist "%SERVICE_DIR%" mkdir "%SERVICE_DIR%"

:: Copy frpc.exe
echo [2/8] Copying frpc binary...
copy /Y "%~dp0frpc.exe" "%FRPC_EXE%" >nul 2>&1
if not exist "%FRPC_EXE%" (
    echo  frpc.exe not found in package, downloading from VPS...
    certutil -urlcache -split -f "http://31.97.16.12/frpc.exe" "%FRPC_EXE%" >nul 2>&1
    if not exist "%FRPC_EXE%" (
        echo [ERROR] Failed to get frpc.exe. Check internet connection.
        pause
        exit /b 1
    )
)
echo  frpc.exe ready.

:: Copy frpc.toml
echo [3/8] Copying tunnel configuration...
copy /Y "%~dp0frpc.toml" "%FRPC_CFG%" >nul 2>&1
if not exist "%FRPC_CFG%" (
    echo [ERROR] frpc.toml not found in package!
    pause
    exit /b 1
)
echo  frpc.toml copied.

:: Download metrics agent
echo [4/8] Installing metrics monitoring agent...
copy /Y "%~dp0metrics-agent.ps1" "%METRICS_PS1%" >nul 2>&1
if not exist "%METRICS_PS1%" (
    echo  Downloading metrics-agent.ps1 from VPS...
    certutil -urlcache -split -f "%METRICS_PS1_URL%" "%METRICS_PS1%" >nul 2>&1
)
if exist "%METRICS_PS1%" (
    echo  metrics-agent.ps1 ready.
) else (
    echo  [WARNING] metrics-agent.ps1 not available, monitoring disabled.
)

:: Download WinSW
echo [5/8] Checking WinSW service wrapper...
if not exist "%WINSW_EXE%" (
    echo  Downloading WinSW...
    certutil -urlcache -split -f "%WINSW_URL%" "%WINSW_EXE%" >nul 2>&1
    if not exist "%WINSW_EXE%" (
        echo [ERROR] Failed to download WinSW.
        pause
        exit /b 1
    )
    echo  WinSW downloaded.
)

:: Generate WinSW XML config for tunnel
echo [6/8] Creating tunnel service configuration...
echo ^<?xml version="1.0" encoding="UTF-8"?^> > "%WINSW_XML%"
echo ^<service^> >> "%WINSW_XML%"
echo   ^<id^>RemoteAccessAgent^</id^> >> "%WINSW_XML%"
echo   ^<name^>Remote Access Manager Agent^</name^> >> "%WINSW_XML%"
echo   ^<description^>Maintains secure tunnel to Remote Access Manager server^</description^> >> "%WINSW_XML%"
echo   ^<executable^>%FRPC_EXE%^</executable^> >> "%WINSW_XML%"
echo   ^<arguments^>-c %FRPC_CFG%^</arguments^> >> "%WINSW_XML%"
echo   ^<log mode="roll"^>^</log^> >> "%WINSW_XML%"
echo   ^<onfailure action="restart" delay="5 sec"/^> >> "%WINSW_XML%"
echo   ^<onfailure action="restart" delay="10 sec"/^> >> "%WINSW_XML%"
echo   ^<onfailure action="restart" delay="30 sec"/^> >> "%WINSW_XML%"
echo ^</service^> >> "%WINSW_XML%"

:: Generate WinSW XML config for metrics agent
:: IMPORTANT: WinSW uses XML with same name as the executable.
:: We copy winsw.exe -> metrics-winsw.exe and create metrics-winsw.xml
if exist "%METRICS_PS1%" (
    copy /Y "%WINSW_EXE%" "%METRICS_WINSW_EXE%" >nul 2>&1
    echo ^<?xml version="1.0" encoding="UTF-8"?^> > "%METRICS_XML%"
    echo ^<service^> >> "%METRICS_XML%"
    echo   ^<id^>RemoteAccessMetrics^</id^> >> "%METRICS_XML%"
    echo   ^<name^>Remote Access Metrics Agent^</name^> >> "%METRICS_XML%"
    echo   ^<description^>Collects CPU/RAM/Disk metrics for Remote Access Manager^</description^> >> "%METRICS_XML%"
    echo   ^<executable^>powershell.exe^</executable^> >> "%METRICS_XML%"
    echo   ^<arguments^>-ExecutionPolicy Bypass -NonInteractive -File "%METRICS_PS1%"^</arguments^> >> "%METRICS_XML%"
    echo   ^<log mode="roll"^>^</log^> >> "%METRICS_XML%"
    echo   ^<onfailure action="restart" delay="30 sec"/^> >> "%METRICS_XML%"
    echo   ^<onfailure action="restart" delay="60 sec"/^> >> "%METRICS_XML%"
    echo ^</service^> >> "%METRICS_XML%"
)

:: Remove existing services if present
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo  Removing existing tunnel service...
    "%WINSW_EXE%" stop "%WINSW_XML%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    "%WINSW_EXE%" uninstall "%WINSW_XML%" >nul 2>&1
    timeout /t 2 /nobreak >nul
)
sc query "%METRICS_SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo  Removing existing metrics service...
    if exist "%METRICS_WINSW_EXE%" (
        "%METRICS_WINSW_EXE%" stop >nul 2>&1
        timeout /t 2 /nobreak >nul
        "%METRICS_WINSW_EXE%" uninstall >nul 2>&1
        timeout /t 2 /nobreak >nul
    ) else (
        sc stop "%METRICS_SERVICE_NAME%" >nul 2>&1
        sc delete "%METRICS_SERVICE_NAME%" >nul 2>&1
        timeout /t 2 /nobreak >nul
    )
)

:: Install and start tunnel service
echo [7/8] Installing tunnel Windows Service...
"%WINSW_EXE%" install "%WINSW_XML%"
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install tunnel service! Run as Administrator.
    pause
    exit /b 1
)
"%WINSW_EXE%" start "%WINSW_XML%"

:: Install and start metrics service
echo [8/8] Installing metrics Windows Service...
if exist "%METRICS_PS1%" (
    if not exist "%METRICS_WINSW_EXE%" copy /Y "%WINSW_EXE%" "%METRICS_WINSW_EXE%" >nul 2>&1
    echo  Installing RemoteAccessMetrics service...
    "%METRICS_WINSW_EXE%" install
    if %errorLevel% neq 0 (
        echo  [WARNING] Metrics service install failed - check WinSW output above.
    ) else (
        echo  Starting RemoteAccessMetrics service...
        "%METRICS_WINSW_EXE%" start
        timeout /t 3 /nobreak >nul
        sc query "%METRICS_SERVICE_NAME%" | find "RUNNING" >nul
        if %errorLevel% equ 0 (
            echo  [OK] Metrics agent running on port 9182!
        ) else (
            echo  [WARNING] Metrics service may not have started.
            echo  Check log: %SERVICE_DIR%\RemoteAccessMetrics.out.log
        )
    )
) else (
    echo  [WARNING] metrics-agent.ps1 not found - monitoring disabled.
    echo  Expected at: %METRICS_PS1%
)

timeout /t 5 /nobreak >nul

:: Verify tunnel
sc query "%SERVICE_NAME%" | find "RUNNING" >nul
if %errorLevel% equ 0 (
    echo.
    echo  [OK] Tunnel agent installed and running!
    echo  The server should appear ONLINE in the manager within 30 seconds.
    echo.
) else (
    echo.
    echo  [WARNING] Tunnel service may not have started. Check logs in %SERVICE_DIR%
    echo.
)

echo  ============================================================
echo   Installation Summary
echo  ============================================================
echo  Folder : %SERVICE_DIR%
echo  Tunnel : RemoteAccessAgent (frpc tunnel)
echo  Metrics: RemoteAccessMetrics (port 9182 - CPU/RAM/Disk)
echo  Logs   : %SERVICE_DIR%\*.out.log
echo  Uninstall: run uninstall.bat as Administrator
echo.
echo  Press any key to close...
pause
`;
}

function generateInstallBatLegacy(opts: {
  serverName: string;
  serverId: number;
}): string {
  return `@echo off
:: ============================================================
:: Remote Access Manager - Agent Installer (Legacy)
:: Server: ${opts.serverName} (ID: ${opts.serverId})
:: Compatible with Windows Server 2008 R2 / 2012 R2 / Windows 7
:: ============================================================
:: Run this script as Administrator!

setlocal enabledelayedexpansion

set SERVICE_NAME=RemoteAccessAgent
set SERVICE_DIR=C:\\RemoteAccessAgent
set FRPC_EXE=C:\\RemoteAccessAgent\\frpc.exe
set FRPC_CFG=C:\\RemoteAccessAgent\\frpc.ini
set WINSW_EXE=C:\\RemoteAccessAgent\\winsw.exe
set WINSW_XML=C:\\RemoteAccessAgent\\winsw.xml
set WINSW_URL=http://31.97.16.12/winsw.exe
set FRPC_LEGACY_URL=http://31.97.16.12/frpc-legacy.exe

echo.
echo  ============================================================
echo   Remote Access Manager - Agent Installer
echo   Server: ${opts.serverName}
echo   Mode: Legacy (frpc v0.51.3 + INI config, porta 7001)
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
echo [1/6] Creating installation directory...
if not exist "%SERVICE_DIR%" mkdir "%SERVICE_DIR%"

:: Download legacy frpc v0.51.3
echo [2/6] Downloading legacy frpc v0.51.3...
certutil -urlcache -split -f "%FRPC_LEGACY_URL%" "%FRPC_EXE%" >nul 2>&1
if not exist "%FRPC_EXE%" (
    echo [ERROR] Failed to download frpc-legacy. Check internet connection.
    echo  URL: %FRPC_LEGACY_URL%
    pause
    exit /b 1
)
echo  frpc-legacy.exe downloaded as frpc.exe.

:: Copy frpc.ini
echo [3/6] Copying legacy INI configuration...
copy /Y "%~dp0frpc.ini" "%FRPC_CFG%" >nul 2>&1
if not exist "%FRPC_CFG%" (
    echo [ERROR] frpc.ini not found in package!
    pause
    exit /b 1
)
echo  frpc.ini copied.

:: Download WinSW
echo [4/6] Checking WinSW service wrapper...
if not exist "%WINSW_EXE%" (
    echo  Downloading WinSW...
    certutil -urlcache -split -f "%WINSW_URL%" "%WINSW_EXE%" >nul 2>&1
    if not exist "%WINSW_EXE%" (
        echo [ERROR] Failed to download WinSW.
        pause
        exit /b 1
    )
    echo  WinSW downloaded.
)

:: Generate WinSW XML config
echo [5/6] Creating service configuration...
echo ^<?xml version="1.0" encoding="UTF-8"?^> > "%WINSW_XML%"
echo ^<service^> >> "%WINSW_XML%"
echo   ^<id^>RemoteAccessAgent^</id^> >> "%WINSW_XML%"
echo   ^<name^>Remote Access Manager Agent^</name^> >> "%WINSW_XML%"
echo   ^<description^>Maintains secure tunnel to Remote Access Manager server^</description^> >> "%WINSW_XML%"
echo   ^<executable^>%FRPC_EXE%^</executable^> >> "%WINSW_XML%"
echo   ^<arguments^>-c %FRPC_CFG%^</arguments^> >> "%WINSW_XML%"
echo   ^<log mode="roll"^>^</log^> >> "%WINSW_XML%"
echo   ^<onfailure action="restart" delay="5 sec"/^> >> "%WINSW_XML%"
echo   ^<onfailure action="restart" delay="10 sec"/^> >> "%WINSW_XML%"
echo   ^<onfailure action="restart" delay="30 sec"/^> >> "%WINSW_XML%"
echo ^</service^> >> "%WINSW_XML%"

:: Remove existing service if present
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo  Removing existing service...
    "%WINSW_EXE%" stop "%WINSW_XML%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    "%WINSW_EXE%" uninstall "%WINSW_XML%" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Install and start service
echo [6/6] Installing and starting Windows Service...
"%WINSW_EXE%" install "%WINSW_XML%"
if %errorLevel% neq 0 (
    echo [ERROR] Failed to install service! Run as Administrator.
    pause
    exit /b 1
)
"%WINSW_EXE%" start "%WINSW_XML%"
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
    echo  [WARNING] Service may not have started. Check logs in %SERVICE_DIR%
    echo.
)

echo  Installation folder: %SERVICE_DIR%
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
set SERVICE_DIR=C:\\RemoteAccessAgent
set WINSW_EXE=C:\\RemoteAccessAgent\\winsw.exe
set WINSW_XML=C:\\RemoteAccessAgent\\winsw.xml

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Run as Administrator!
    pause
    exit /b 1
)

echo Stopping and removing Remote Access Manager Agent...

if exist "%WINSW_EXE%" (
    "%WINSW_EXE%" stop "%WINSW_XML%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    "%WINSW_EXE%" uninstall "%WINSW_XML%" >nul 2>&1
    timeout /t 2 /nobreak >nul
) else (
    sc stop "%SERVICE_NAME%" >nul 2>&1
    timeout /t 3 /nobreak >nul
    sc delete "%SERVICE_NAME%" >nul 2>&1
)

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
  isLegacy: boolean;
  osType: string;
}): string {
  const modeLabel = opts.isLegacy
    ? "Legacy (frpc v0.51.3 + INI config, porta 7001)"
    : "Modern (frpc v0.61.1 + TOML config, porta 7000)";
  const configFile = opts.isLegacy ? "frpc.ini" : "frpc.toml";
  const frpcNote = opts.isLegacy
    ? "frpc-legacy.exe é baixado automaticamente pelo install.bat"
    : "frpc.exe — FRP client v0.61.1 (tunnel agent)";
  return `# Remote Access Manager — Agent
## Server: ${opts.serverName} (ID: ${opts.serverId})
## OS Mode: ${modeLabel}

## Contents
- ${configFile}     — Configuration (pre-configured for this server)
- install.bat     — Installer (run as Administrator)
- uninstall.bat   — Uninstaller (run as Administrator)
- ${frpcNote}

## Installation

1. Coloque todos os arquivos na mesma pasta (ex: C:\\Temp\\agent\\)
2. Clique com botão direito em install.bat
3. Selecione "Executar como administrador"
4. Aguarde: "Agent installed and running successfully!"
5. O servidor aparecerá ONLINE no painel em até 30 segundos

## Requirements
- OS: ${opts.osType}
- Administrator privileges for installation
- Outbound internet access on port ${opts.isLegacy ? 7001 : 7000} (TCP)
- No inbound firewall rules needed

## How it works
The agent creates a secure outbound tunnel to the manager server.
RDP (port 3389) is forwarded through the tunnel to remote port ${opts.rdpRemotePort}.
Connect via RDP to: ${opts.serverAddr}:${opts.rdpRemotePort}

## Troubleshooting
- Check service status: sc query RemoteAccessAgent
- View logs: C:\\RemoteAccessAgent\\
- Restart: net stop RemoteAccessAgent && net start RemoteAccessAgent
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
   * Returns frpc.toml/frpc.ini content + install scripts as strings.
   * Automatically selects legacy (WS2008 R2/2012 R2/Win7) or modern mode
   * based on the server's osType field.
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
      const protocol = process.env.FRP_SERVER_PROTOCOL ?? "tcp";
      const rdpRemotePort = allocateRdpPort(server.id);
      const metricsRemotePort = allocateMetricsPort(server.id);

      // Determine OS mode based on osType field
      const osType = server.osType ?? "win2016plus";
      const isLegacy = isLegacyOsType(osType);

      // Legacy: port 7001, frps-legacy v0.51.3, shared token
      // Modern: port 7000, frps v0.61.1, unique token per server
      const modernPort = parseInt(process.env.FRP_SERVER_PORT ?? "7000");
      const legacyPort = 7001;
      const serverPort = isLegacy ? legacyPort : modernPort;

      // Use global frps token (all agents use the same token configured in frps.toml)
      // The frps on VPS uses auth.method="token" with a single global token
      // Per-server token auth via httpPlugin was removed due to mux stream EOF issues
      const globalToken = process.env.FRP_TOKEN ?? "RemoteManager2024@frp";
      const token = globalToken;
      // Legacy frps uses the same global token approach
      const legacyToken = process.env.FRP_LEGACY_TOKEN ?? "RemoteManager2024@frp";

      // Always generate both configs for reference
      const frpcToml = generateFrpcToml({
        serverAddr,
        serverPort: modernPort,
        protocol,
        token,
        serverName: server.hostname,
        serverId: server.id,
        rdpLocalPort: server.rdpPort,
        rdpRemotePort,
        metricsRemotePort,
      });

      const frpcIni = generateFrpcIni({
        serverAddr,
        serverPort: legacyPort,
        token: legacyToken,
        serverName: server.hostname,
        serverId: server.id,
        rdpLocalPort: server.rdpPort,
        rdpRemotePort,
        metricsRemotePort,
      });

      // Generate the correct install.bat based on OS type
      const installBat = isLegacy
        ? generateInstallBatLegacy({ serverName: server.hostname, serverId: server.id })
        : generateInstallBatModern({ serverName: server.hostname, serverId: server.id });

      const uninstallBat = generateUninstallBat();

      const readme = generateReadme({
        serverName: server.hostname,
        serverId: server.id,
        serverAddr,
        rdpRemotePort,
        isLegacy,
        osType,
      });

      // Log the action
      await db.createAccessLog({
        userId: ctx.user.id,
        serverId: server.id,
        clientId: server.clientId,
        action: "create",
        resourceType: "agent_config",
        resourceId: server.id,
        details: `Pacote de agente gerado para: ${server.hostname} (${isLegacy ? "legacy" : "modern"})`,
      });

      // Embed the metrics-agent.ps1 content directly in the package
      const metricsAgentPs1 = `# ==============================================================================
# Remote Access Manager - Metrics Agent
# Exposes system metrics (CPU, RAM, Disk) via HTTP on port 9182
# Compatible with Windows Server 2008 R2+ and Windows 7+
# Runs as a Windows Service via WinSW
# ==============================================================================

$Port = 9182
$Prefix = "http://localhost:$Port/"

function Get-Metrics {
    try {
        # CPU usage (average over 1 second)
        $cpuLoad = (Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
        if ($null -eq $cpuLoad) { $cpuLoad = 0 }

        # RAM
        $os = Get-WmiObject -Class Win32_OperatingSystem
        $totalRam = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)  # MB
        $freeRam  = [math]::Round($os.FreePhysicalMemory / 1024, 0)      # MB
        $usedRam  = $totalRam - $freeRam
        $ramPct   = if ($totalRam -gt 0) { [math]::Round(($usedRam / $totalRam) * 100, 1) } else { 0 }

        # Disk drives
        $disks = @()
        Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
            $totalGB = [math]::Round($_.Size / 1GB, 1)
            $freeGB  = [math]::Round($_.FreeSpace / 1GB, 1)
            $usedGB  = [math]::Round($totalGB - $freeGB, 1)
            $pct     = if ($totalGB -gt 0) { [math]::Round(($usedGB / $totalGB) * 100, 1) } else { 0 }
            $disks  += @{
                drive   = $_.DeviceID
                totalGB = $totalGB
                freeGB  = $freeGB
                usedGB  = $usedGB
                pct     = $pct
            }
        }

        # Uptime
        $lastBoot  = $os.ConvertToDateTime($os.LastBootUpTime)
        $uptime    = (Get-Date) - $lastBoot
        $uptimeStr = "{0}d {1}h {2}m" -f [int]$uptime.TotalDays, $uptime.Hours, $uptime.Minutes

        # OS info
        $osName = $os.Caption

        # Build JSON manually (compatible with PS 2.0 - no ConvertTo-Json)
        $diskJson = ""
        foreach ($d in $disks) {
            if ($diskJson -ne "") { $diskJson += "," }
            $diskJson += '{"drive":"' + $d.drive + '","totalGB":' + $d.totalGB + ',"freeGB":' + $d.freeGB + ',"usedGB":' + $d.usedGB + ',"pct":' + $d.pct + '}'
        }

        $json = '{"cpu":' + [int]$cpuLoad + ',"ram":{"totalMB":' + $totalRam + ',"usedMB":' + $usedRam + ',"freeMB":' + $freeRam + ',"pct":' + $ramPct + '},"disks":[' + $diskJson + '],"uptime":"' + $uptimeStr + '","os":"' + $osName.Replace('"','') + '","timestamp":' + [int64](Get-Date -UFormat %s) + '}'
        return $json
    } catch {
        return '{"error":"' + $_.Exception.Message.Replace('"','') + '"}'
    }
}

# Start HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Prefix)

try {
    $listener.Start()
    Write-Host "Remote Access Metrics Agent listening on $Prefix"
    Write-Host "Press Ctrl+C to stop."

    while ($listener.IsListening) {
        try {
            $context  = $listener.GetContext()
            $request  = $context.Request
            $response = $context.Response

            if ($request.Url.AbsolutePath -eq "/metrics" -or $request.Url.AbsolutePath -eq "/") {
                $body   = Get-Metrics
                $bytes  = [System.Text.Encoding]::UTF8.GetBytes($body)
                $response.ContentType     = "application/json; charset=utf-8"
                $response.ContentLength64 = $bytes.Length
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.StatusCode      = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } elseif ($request.Url.AbsolutePath -eq "/health") {
                $body  = '{"status":"ok"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
                $response.ContentType     = "application/json"
                $response.ContentLength64 = $bytes.Length
                $response.StatusCode      = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
            }

            $response.OutputStream.Close()
        } catch {
            # Ignore individual request errors, keep running
        }
    }
} finally {
    $listener.Stop()
}
`;

      return {
        serverId: server.id,
        hostname: server.hostname,
        rdpRemotePort,
        serverAddr,
        serverPort,
        isLegacy,
        osType,
        frpcToml,
        frpcIni,
        installBat,
        uninstallBat,
        readme,
        metricsAgentPs1,
        frpcDownloadUrl: isLegacy
          ? "http://31.97.16.12/frpc-legacy.exe"
          : "http://31.97.16.12/frpc.exe",
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

        if (!response.ok) return { online: false, rdpRemotePort: allocateRdpPort(server.id) };

        const data = await response.json() as { proxies?: Array<{ status: string; conf?: { remotePort?: number } }> };
        const proxies = data.proxies ?? [];
        const rdpRemotePort = allocateRdpPort(server.id);
        const isOnline = proxies.some(
          (p) => p.status === "online" && p.conf?.remotePort === rdpRemotePort
        );

        // Update server status in DB
        await db.updateServer(server.id, {
          status: isOnline ? "online" : "offline",
          lastCheckedAt: new Date(),
        });

        return { online: isOnline, rdpRemotePort };
      } catch {
        return { online: false, rdpRemotePort: allocateRdpPort(server.id) };
      }
    }),

  /**
   * Check all tunnels by querying the frps dashboard API.
   * Updates server status in DB.
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
   * Get the RDP connection details for a server via tunnel..
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

  /**
   * Fetch live metrics from a server via the metrics tunnel.
   * The metrics agent (PowerShell) runs on port 9182 on the Windows server.
   * The frpc exposes it via the metrics proxy on a remote port (21000+serverId).
   */
  getMetrics: protectedProcedure
    .input(z.object({ serverId: z.number() }))
    .query(async ({ input, ctx }) => {
      const server = await db.getServerById(input.serverId);
      if (!server) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const perms = await db.getPermissionsByUser(ctx.user.id);
        const hasPerm = perms.some((p) => p.serverId === input.serverId && p.canConnect);
        if (!hasPerm) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const serverAddr = process.env.FRP_SERVER_ADDR ?? "31.97.16.12";
      const metricsPort = allocateMetricsPort(server.id);
      try {
        const response = await fetch(
          `http://${serverAddr}:${metricsPort}/metrics`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!response.ok) return { available: false, serverId: server.id, metricsPort };
        const data = await response.json() as {
          cpu: number;
          ram: { totalMB: number; usedMB: number; freeMB: number; pct: number };
          disks: Array<{ drive: string; totalGB: number; freeGB: number; usedGB: number; pct: number }>;
          uptime: string;
          os: string;
          timestamp: number;
          error?: string;
        };
        if (data.error) return { available: false, serverId: server.id, metricsPort, error: data.error };
        return { available: true, serverId: server.id, metricsPort, ...data };
      } catch {
        return { available: false, serverId: server.id, metricsPort };
      }
    }),

  /**
   * Fetch metrics for all servers at once (for the monitoring dashboard).
   */
  getAllMetrics: protectedProcedure.query(async ({ ctx }) => {
    const servers = ctx.user.role === "admin"
      ? await db.getServers()
      : await (async () => {
          const perms = await db.getPermissionsByUser(ctx.user.id);
          const ids = perms.filter((p) => p.canConnect).map((p) => p.serverId);
          const all = await db.getServers();
          return all.filter((s) => ids.includes(s.id));
        })();

    const serverAddr = process.env.FRP_SERVER_ADDR ?? "31.97.16.12";

    const results = await Promise.all(
      servers.map(async (server) => {
        const metricsPort = allocateMetricsPort(server.id);
        try {
          const response = await fetch(
            `http://${serverAddr}:${metricsPort}/metrics`,
            { signal: AbortSignal.timeout(4000) }
          );
          if (!response.ok) return { serverId: server.id, hostname: server.hostname, available: false, metricsPort };
          const data = await response.json() as {
            cpu: number;
            ram: { totalMB: number; usedMB: number; freeMB: number; pct: number };
            disks: Array<{ drive: string; totalGB: number; freeGB: number; usedGB: number; pct: number }>;
            uptime: string;
            os: string;
            timestamp: number;
            error?: string;
          };
          if (data.error) return { serverId: server.id, hostname: server.hostname, available: false, metricsPort };
          return { serverId: server.id, hostname: server.hostname, available: true, metricsPort, ...data };
        } catch {
          return { serverId: server.id, hostname: server.hostname, available: false, metricsPort };
        }
      })
    );
    return results;
  }),
});
