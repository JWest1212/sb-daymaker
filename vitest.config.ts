import { defineConfig, configDefaults } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the "@/..." path alias (tsconfig paths) for tests. Next.js resolves it
// in the app; vitest needs it declared here so lib/plan/* (which imports via "@/")
// runs under `vitest run`. Additive: existing relative-import tests are unaffected.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // This repo lives in an iCloud-synced folder, which evicts files inside
    // node_modules and leaves node the module resolver blocked on a synchronous
    // read that never returns. Dependencies therefore install into
    // `node_modules.nosync/` (iCloud skips any name ending in .nosync) with
    // `node_modules` as a symlink to it, the same trick `.next.nosync` uses.
    // Vitest's default ignore list only knows the literal `node_modules`, so the
    // real directory has to be named here or third-party tests get collected.
    exclude: [...configDefaults.exclude, "**/node_modules.nosync/**"],
  },
});
