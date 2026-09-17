import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { getRequestListener } from '@hono/node-server';

function unifiedApiPlugin(): Plugin {
  return {
    name: 'unified-api-plugin',
    async configureServer(server) {
      const { app, initApp } = await import('./src/server/app.js');
      await initApp();
      const handler = getRequestListener(app.fetch);

      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?'))) {
          return handler(req, res);
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), unifiedApiPlugin()],
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
});
