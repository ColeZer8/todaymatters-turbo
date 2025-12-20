import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  ...config,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ["android/**", "ios/**", "dist/**", ".expo/**"],
  },
];

