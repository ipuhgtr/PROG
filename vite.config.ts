// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        // Manifest estático em public/manifest.webmanifest (pt-BR).
        manifest: false,
        strategies: "generateSW",
        filename: "sw.js",
        // O Nitro publica o cliente em .output/public; o sw.js precisa ir junto.
        outDir: ".output/public",
        // "prompt": avisa o usuário em vez de recarregar no meio de um formulário.
        registerType: "prompt",
        // O único registro é src/pwa/registrar.ts.
        injectRegister: null,
        devOptions: { enabled: false },
        workbox: {
          globDirectory: ".output/public",
          navigateFallback: null,
          navigateFallbackDenylist: [/^\/~oauth/],
          globPatterns: ["**/*.{js,css,png,svg,ico,woff2,webmanifest}"],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "prep-paginas", networkTimeoutSeconds: 5 },
            },
          ],
        },
      }),
    ],
  },
});
