import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Playwright fixtures use a `use(value)` callback that the react-hooks rule
  // mistakes for the React `use` hook. Disable it for the E2E suite only.
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    files: ["e2e/**/*.spec.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@playwright/test",
          importNames: ["test", "expect"],
          message: "Import test and expect from ./fixtures for onboarding and database isolation.",
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Browser artifacts contain third-party bundled JS, not repository source.
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
]);

export default eslintConfig;
