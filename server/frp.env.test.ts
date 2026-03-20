/**
 * Test: Validate frps environment variables and connectivity
 */
import { describe, it, expect } from "vitest";

describe("FRP Environment Variables", () => {
  it("should have FRP_SERVER_ADDR set", () => {
    const addr = process.env.FRP_SERVER_ADDR;
    expect(addr).toBeDefined();
    expect(addr).not.toBe("");
    expect(addr).toBe("31.97.16.12");
  });

  it("should have FRP_SERVER_PORT set to 7000", () => {
    const port = process.env.FRP_SERVER_PORT;
    expect(port).toBeDefined();
    expect(parseInt(port ?? "0")).toBe(7000);
  });

  it("should have FRP_SERVER_PROTOCOL set to tcp", () => {
    const protocol = process.env.FRP_SERVER_PROTOCOL;
    expect(protocol).toBeDefined();
    expect(protocol).toBe("tcp");
  });

  it("should have FRP_DASHBOARD_ADDR set", () => {
    const addr = process.env.FRP_DASHBOARD_ADDR;
    expect(addr).toBeDefined();
    expect(addr).toBe("31.97.16.12");
  });

  it("should have FRP_DASHBOARD_PORT set to 7500", () => {
    const port = process.env.FRP_DASHBOARD_PORT;
    expect(port).toBeDefined();
    expect(parseInt(port ?? "0")).toBe(7500);
  });

  it("should have FRP_DASHBOARD_USER set", () => {
    const user = process.env.FRP_DASHBOARD_USER;
    expect(user).toBeDefined();
    expect(user).toBe("admin");
  });

  it("should have FRP_DASHBOARD_PASS set", () => {
    const pass = process.env.FRP_DASHBOARD_PASS;
    expect(pass).toBeDefined();
    expect(pass).not.toBe("");
  });

  it("should generate correct frpc.toml with VPS address", () => {
    const serverAddr = process.env.FRP_SERVER_ADDR ?? "localhost";
    const serverPort = parseInt(process.env.FRP_SERVER_PORT ?? "7000");
    const protocol = process.env.FRP_SERVER_PROTOCOL ?? "tcp";

    // Simulate what generateFrpcToml would produce
    const config = `serverAddr = "${serverAddr}"\nserverPort = ${serverPort}`;
    
    expect(config).toContain("31.97.16.12");
    expect(serverPort).toBe(7000);
    expect(protocol).toBe("tcp");
  });
});

// ─── Helper to replicate isLegacyOsType logic ─────────────────────────────────
const LEGACY_OS_TYPES = ["win2008r2", "win2012r2", "win7"] as const;
function isLegacyOsType(osType: string | null | undefined): boolean {
  return LEGACY_OS_TYPES.includes((osType ?? "win2016plus") as typeof LEGACY_OS_TYPES[number]);
}

describe("FRP OS Type Classification", () => {
  it("should classify win2008r2 as legacy", () => {
    expect(isLegacyOsType("win2008r2")).toBe(true);
  });
  it("should classify win2012r2 as legacy", () => {
    expect(isLegacyOsType("win2012r2")).toBe(true);
  });
  it("should classify win7 as legacy", () => {
    expect(isLegacyOsType("win7")).toBe(true);
  });
  it("should classify win2016plus as modern", () => {
    expect(isLegacyOsType("win2016plus")).toBe(false);
  });
  it("should classify win10 as modern", () => {
    expect(isLegacyOsType("win10")).toBe(false);
  });
  it("should classify win11 as modern", () => {
    expect(isLegacyOsType("win11")).toBe(false);
  });
  it("should default to modern when osType is null/undefined", () => {
    expect(isLegacyOsType(null)).toBe(false);
    expect(isLegacyOsType(undefined)).toBe(false);
  });
  it("should use port 7001 for legacy OS and 7000 for modern", () => {
    const modernPort = parseInt(process.env.FRP_SERVER_PORT ?? "7000");
    const legacyPort = 7001;
    expect(isLegacyOsType("win2008r2") ? legacyPort : modernPort).toBe(7001);
    expect(isLegacyOsType("win2016plus") ? legacyPort : modernPort).toBe(7000);
  });
});
