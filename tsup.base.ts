import { defineConfig } from "tsup";

export const createTsupConfig = (external: string[] = []) =>
  defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    splitting: true,
    treeshake: true,
    clean: true,
    external,
    outExtension({ format }) {
      return {
        js: format === "cjs" ? ".cjs" : ".js",
      };
    },
  });
