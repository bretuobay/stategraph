import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    devtools: "src/devtools/index.tsx",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  clean: true,
  external: ["@stategraph/core", "@stategraph/inspect", "react", "react-dom"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
