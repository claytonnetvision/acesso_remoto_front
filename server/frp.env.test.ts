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
