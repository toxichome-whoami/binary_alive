// cPanel LiteSpeed/Passenger expects a CommonJS file.
require('tsx/cjs/api').register();
require('./src/server/index.ts');
