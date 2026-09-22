// cPanel Passenger entry point
// This file is required by cPanel's "Setup Node.js App" as the startup file.
// It uses tsx's ESM API to load and run the TypeScript backend server.
import { register } from 'tsx/esm/api';
register();
await import('./src/server/index.ts');
