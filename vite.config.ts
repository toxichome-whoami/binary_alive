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
      
      const { getInjectWebSocket } = await import('./src/server/websocket.js');
      if (server.httpServer) {
        // Create a dummy server just to extract Hono's upgrade handler safely
        const { EventEmitter } = await import('events');
        const dummyServer = new EventEmitter() as any;
        getInjectWebSocket()(dummyServer);
        
        // Listen to the real server, only forward valid ws endpoints
        server.httpServer.on('upgrade', (req, socket, head) => {
          if (req.url) {
            const path = req.url.split('?')[0];
            if (path === '/api/ws' || path === '/api/terminal/ws') {
              dummyServer.emit('upgrade', req, socket, head);
            }
          }
        });
      }

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
