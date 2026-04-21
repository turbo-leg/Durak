import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Prevent picking up transpiled/bundled output under dist/
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
    ],
  },
});
