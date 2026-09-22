// cPanel Passenger / LiteSpeed entry point
// We use dynamic import() because require() fails on ESM modules with top-level await.
import('tsx/esm/api').then(({ register }) => {
    register();
    return import('./src/server/index.ts');
}).catch(err => {
    console.error('Failed to start server:', err);
});
