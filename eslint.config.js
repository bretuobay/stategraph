import js from "@eslint/js";
import tseslint from "typescript-eslint";

const restrictedImports = [
  {
    group: ["@stategraph/*/src/*", "apps/*"],
    message: "Import from public package barrels only; packages must not import app code.",
  },
];

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": ["error", { patterns: restrictedImports }],
    },
  },
);
