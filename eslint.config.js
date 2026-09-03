import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.js"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Importing directly from @prisma/client is forbidden outside repositories and database.types.ts (Rule: AGENTS.md). Use src/common/constants or src/common/types/database.types.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/**/*.repository.ts",
      "src/database/prisma.client.ts",
      "src/common/types/database.types.ts",
      "src/**/__tests__/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
