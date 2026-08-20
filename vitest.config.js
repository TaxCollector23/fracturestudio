import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "app/src/**/*.test.js"],
    // These tests cover pure logic only; no browser APIs required.
    testTimeout: 15000
  }
});
