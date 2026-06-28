import { defineConfig } from "vitest/config";

export const stategraphVitestConfig = defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
  },
});
