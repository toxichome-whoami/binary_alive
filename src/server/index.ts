import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { app, initApp } from './app.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  try {
    console.log('[Binary Alive] Initializing backend engine...');
    await initApp();
    console.log('[Binary Alive] Backend engine ready.');

    const { getInjectWebSocket } = await import('./websocket.js');

    const server = serve(
      {
        fetch: app.fetch,
        port: PORT,
      },
      (info) => {
        console.log(`[Binary Alive] Server running at http://localhost:${info.port}`);
      }
    );
    
    getInjectWebSocket()(server);
  } catch (err) {
    console.error('[Binary Alive] Fatal startup error:', err);
    process.exit(1);
  }
}

start();
