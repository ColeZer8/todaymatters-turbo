import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  ...nextJsConfig,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];


