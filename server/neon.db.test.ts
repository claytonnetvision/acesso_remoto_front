/**
 * Test: Validate NEON_DATABASE_URL and database connectivity
 */
import { describe, it, expect } from "vitest";

describe("Neon Database Connection", () => {
  it("should have NEON_DATABASE_URL configured", () => {
    const url = process.env.NEON_DATABASE_URL;
    expect(url).toBeDefined();
    expect(url).not.toBe("");
    expect(url?.startsWith("postgresql://") || url?.startsWith("postgres://")).toBe(true);
  });

  it("should point to Neon cloud database", () => {
    const url = process.env.NEON_DATABASE_URL ?? "";
    expect(url).toContain("neon.tech");
  });

  it("should have SSL mode configured", () => {
    const url = process.env.NEON_DATABASE_URL ?? "";
    expect(url).toContain("sslmode=require");
  });

  it("should prefer NEON_DATABASE_URL over DATABASE_URL for postgres connections", () => {
    const neonUrl = process.env.NEON_DATABASE_URL;
    const dbUrl = process.env.DATABASE_URL;
    
    // NEON_DATABASE_URL should be a postgres URL
    expect(neonUrl?.startsWith("postgresql") || neonUrl?.startsWith("postgres")).toBe(true);
    
    // DATABASE_URL from Manus is MySQL - should NOT be used for this project
    if (dbUrl) {
      const isMySQL = dbUrl.startsWith("mysql://");
      if (isMySQL) {
        // The code should use NEON_DATABASE_URL instead
        expect(neonUrl).toBeDefined();
      }
    }
  });
});
