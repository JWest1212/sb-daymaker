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
    ".next.nosync/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // iCloud: dependencies live here with node_modules as a symlink to it, so
    // eslint's built-in node_modules ignore does not match the real path.
    "node_modules.nosync/**",
    "experiments/**",
  ]),
]);

export default eslintConfig;
