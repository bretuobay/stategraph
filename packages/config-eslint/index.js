import js from "@eslint/js";
import tseslint from "typescript-eslint";

export const stategraphEslintConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@stategraph/*/src/*", "apps/*"],
              message:
                "Import from package public barrels only; packages must not import app code.",
            },
          ],
        },
      ],
    },
  },
);
