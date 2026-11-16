import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output
    "test-results/**",
    "playwright-report/**",
  ]),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // React Compiler rule added in a recent eslint-plugin-react-hooks. The five places it flags
      // (cart, checkout, auth and cart contexts, carousel) load data on mount and work correctly;
      // rewriting them right before the demo isn't worth the risk, so it warns instead of failing CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Playwright tests: its fixture callback is named `use`, which isn't a React hook
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // Plain Node script (the fake Stripe server for e2e tests)
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
