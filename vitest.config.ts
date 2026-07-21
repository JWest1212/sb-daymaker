import { defineConfig } from "vitest/config";
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
});
