import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import { completeOrionChat } from "./server/orion";
import { authenticateCommunityRequest } from "./server/community-ai";
import { applySourceProposal, createManualSourceProposal, createSourceProposal, ensureSourceVersion, getSourceFile, listSourceProposals } from "./server/source-versions";

function manusOrionDevEndpoint(): Plugin {
  return {
    name: "manus-orion-dev-endpoint",
    configureServer(server) {
      server.middlewares.use("/api/orion/chat", (request, response, next) => {
        if (request.method !== "POST") return next();
        let raw = "";
        request.on("data", chunk => { raw += String(chunk); });
        request.on("error", next);
        request.on("end", () => {
          void (async () => {
            try {
              const body = JSON.parse(raw || "{}") as { history?: unknown; options?: { temperature?: unknown } };
              const result = await completeOrionChat(body.history, body.options);
              response.setHeader("Content-Type", "application/json");
              response.end(JSON.stringify(result));
            } catch (error) {
              const message = error instanceof Error ? error.message : "No se pudo consultar a Orión.";
              response.statusCode = 400;
              response.setHeader("Content-Type", "application/json");
              response.end(JSON.stringify({ error: message }));
            }
          })();
        });
      });
      const readJson = (request: any) => new Promise<Record<string, unknown>>((resolve, reject) => {
        let raw = "";
        request.on("data", (chunk: unknown) => { raw += String(chunk); });
        request.on("error", reject);
        request.on("end", () => {
          try { resolve(JSON.parse(raw || "{}") as Record<string, unknown>); }
          catch (error) { reject(error); }
        });
      });
      const sendJson = (response: any, status: number, data: unknown) => {
        response.statusCode = status;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(data));
      };
      const runPrivate = (handler: (userId: string, body: Record<string, unknown>, query: URLSearchParams) => Promise<unknown>) => (request: any, response: any, next: any) => {
        void (async () => {
          try {
            const user = await authenticateCommunityRequest(request.headers.authorization);
            const body = request.method === "POST" ? await readJson(request) : {};
            const query = new URL(request.url || "", "http://localhost").searchParams;
            sendJson(response, 200, await handler(user.id, body, query));
          } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo completar la operación de código.";
            sendJson(response, 400, { error: message });
          }
        })();
        void next;
      };
      server.middlewares.use("/api/orion/source-version", (request, response, next) => {
        if (request.method !== "POST") return next();
        return runPrivate((userId, body) => ensureSourceVersion(userId, body.projectId))(request, response, next);
      });
      server.middlewares.use("/api/orion/source-file", (request, response, next) => {
        if (request.method !== "GET") return next();
        return runPrivate((userId, _body, query) => getSourceFile(userId, query.get("projectId"), query.get("versionId"), query.get("path")))(request, response, next);
      });
      server.middlewares.use("/api/orion/source-proposal", (request, response, next) => {
        if (request.method !== "POST") return next();
        return runPrivate((userId, body) => createSourceProposal(userId, body))(request, response, next);
      });
      server.middlewares.use("/api/orion/source-apply", (request, response, next) => {
        if (request.method !== "POST") return next();
        return runPrivate((userId, body) => applySourceProposal(userId, body))(request, response, next);
      });
      server.middlewares.use("/api/orion/source-edit", (request, response, next) => {
        if (request.method !== "POST") return next();
        return runPrivate((userId, body) => createManualSourceProposal(userId, body))(request, response, next);
      });
      server.middlewares.use("/api/orion/source-proposals", (request, response, next) => {
        if (request.method !== "GET") return next();
        return runPrivate((userId, _body, query) => listSourceProposals(userId, query.get("projectId")))(request, response, next);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Exponer también V1/V2/V3 (variables personalizadas del tab Keys) en
  // import.meta.env además del prefijo estándar VITE_.
  envPrefix: ["VITE_", "V1", "V2", "V3"],
  plugins: [react(), manusOrionDevEndpoint(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Mantiene una sola copia de React entre las dependencias de la aplicación.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // El publicador de producción copia el cliente desde `dist/public`.
    // El bundle del servidor se mantiene en `dist/index.js`.
    outDir: "dist/public",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'radix-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'framer-motion': ['framer-motion'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    minify: 'esbuild',
  },
  optimizeDeps: {
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      '@tanstack/react-router',
      '@tanstack/react-query',
      'framer-motion',
    ],
  },
  server: {
    host: true,
    port: 5173,
    // Las vistas previas se exponen mediante subdominios temporales seguros.
    // Aceptar exclusivamente los dominios de Manus evita el bloqueo de Host
    // sin abrir el dev server a hosts arbitrarios.
    allowedHosts: [".manus.computer", ".manus.space"],
    hmr: {
      overlay: false,
    },
    // Proxy del dev server a la Management API de Supabase.
    // La Management API solo permite CORS desde supabase.com; al enrutarla por
    // el dev server (mismo origen), la app puede crear el esquema pegando solo
    // el token sbp_… sin necesidad del SQL Editor. En producción (build
    // estático) no aplica; ahí se usa la ruta directa o el SQL manual.
    proxy: {
      "/__supabase-mgmt": {
        target: "https://api.supabase.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__supabase-mgmt/, "/v1"),
      },
    },
  },
});
