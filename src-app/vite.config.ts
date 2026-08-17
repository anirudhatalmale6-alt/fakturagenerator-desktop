import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Plain static SPA build for the desktop app. The original Lovable project uses
// TanStack Start (SSR + nitro server); a packaged offline app has no server, so
// the same components are rendered client-side from src/main.tsx instead.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Relative asset URLs so the bundle works under the app:// protocol.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
