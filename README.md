# Binary Alive

A self-hosted process supervisor and remote management dashboard. It spawns, monitors, and restarts OS-level processes; provides a browser-based PTY terminal; and exposes a role-gated REST API. Built as a unified Node.js application — the same process serves the API, the WebSocket bus, and the compiled React frontend.

**Status:** v2.0.0 — active development, no stable release tag. Internal APIs may change without notice.

---

## Requirements

| Dependency | Version |
|---|---|
| Node.js | 18+ (ESM required — `"type": "module"` in package.json) |
| npm | 8+ |
| OS | Linux, macOS, or Windows. `node-pty` requires build tools (`python`, `make`, a C++ compiler). |

**This is not a static site.** It cannot be deployed to shared hosting, Netlify, Vercel, or any environment that does not allow persistent Node.js processes. The backend spawns child processes, opens PTY sessions, and holds long-lived WebSocket connections. A VPS or dedicated server with root access is required.

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd binary_alive
npm install

# 2. Configure
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY

# 3. Start the development server
npm run dev
# App available at http://localhost:5173
# Backend API at http://localhost:5173/api
```

On first load, the app detects an empty users table and shows a setup wizard to create the owner account. The owner account cannot be deleted or demoted.

To verify the backend is running:

```bash
curl http://localhost:5173/api/health
# {"status":"online","system":"Binary Alive 2.0 (Unified Vite Engine)","time":"..."}
```

---

## Configuration

All options are read from `.env` at startup via `dotenv`. The app starts without any env file, but `SECRET_KEY` must be set before the first login — sessions will not validate without it.

| Variable | Required | Default | Effect |
|---|---|---|---|
| `SECRET_KEY` | Yes | — | Signs session tokens and CSRF cookies. Minimum 32 chars. |
| `PORT` | No | `3000` | Port for the standalone production server (`src/server/index.ts`). Not used in dev mode (Vite owns the port). |
| `NODE_ENV` | No | `development` | Set to `production` to enable stricter cookie flags. |
| `SESSION_TIMEOUT_MINUTES` | No | `15` | Idle session expiry. |
| `FORCE_HTTPS` | No | `false` | Redirects HTTP to HTTPS. Only useful behind a reverse proxy. |
| `ALLOWED_IPS` | No | `""` (disabled) | Comma-separated IP allowlist. All other IPs get 403. Leave empty to disable. |
| `TURSO_DATABASE_URL` | No | `file:local.db` | libSQL connection string. Use `file:local.db` for local SQLite or a `libsql://` URL for a remote Turso database. |
| `TURSO_AUTH_TOKEN` | No | `""` | Required when `TURSO_DATABASE_URL` is a remote Turso URL. Leave empty for local file. |
| `POLL_INTERVAL` | No | `3000` | How often (ms) the process list endpoint reports as the suggested client poll interval. Returned in the `poll_interval_ms` field of `GET /api/processes`. |
| `AUTO_RESTART_INTERVAL_MS` | No | `30000` | How often (ms) the background cron checks process health and logs telemetry. The code warns to keep this at 30000ms in production. |

---

## Usage

### Running in development

```bash
npm run dev
```

Vite starts on port `5173`. The `unifiedApiPlugin` in `vite.config.ts` mounts the Hono API server inside Vite's dev server, so `/api/*` requests are handled by the backend without a separate proxy configuration. WebSocket upgrade for `/api/ws` and `/api/terminal/ws` is forwarded from Vite's HTTP server to Hono's WS handler.

### Building for production

```bash
npm run build
# Output: dist/ (React frontend only — static assets)
```

The `npm run build` command produces only the frontend. It does **not** produce a standalone backend binary. To run in production you need to run the Node.js server separately and serve the `dist/` directory through it or a reverse proxy.

### Running the production backend

```bash
node src/server/index.ts
# or, with a process manager:
npx tsx src/server/index.ts
```

The server starts on `$PORT` (default `3000`). Point Nginx or Apache to this port and serve `dist/` as the document root with SPA fallback to `index.html`.

Example Nginx config fragment:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/binary_alive/dist;
    index index.html;

    # API and WebSocket
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Keep the Node.js process alive with PM2:

```bash
npm install -g pm2
pm2 start "npx tsx src/server/index.ts" --name binary-alive
pm2 save
pm2 startup
```

---

## How It Works

```
Browser
  │
  ├─ HTTP GET /           → Nginx serves dist/index.html (React SPA)
  ├─ HTTP /api/*          → Nginx reverse-proxies to Node.js :3000
  │    └─ Hono router     → auth | processes | users | terminal | ai | logs | settings
  │         └─ Middleware → ipWhitelist → authMiddleware → csrfProtection → rateLimiter
  │
  ├─ WS /api/ws           → Real-time push: process stats, user presence, settings changes
  └─ WS /api/terminal/ws  → PTY session via node-pty, one per authenticated connection
```

The background cron (running on `AUTO_RESTART_INTERVAL_MS`) calls `runAutorestart()` to check each process with `auto_restart=1` against the OS via `pidusage`/`tasklist`, restarts crashed ones, and calls `logTelemetryData()` to write a row to `telemetry_logs`. The telemetry table drives the analytics charts.

The AI assistant route (`/api/ai/chat`) calls an external LLM and executes structured tool calls (start/stop processes, manage users, run terminal commands) only if the requesting user's per-session AI permissions allow each action. Owner bypass was explicitly removed — AI permissions apply equally to all roles.

---

## Project Structure

```
binary_alive/
├── src/
│   ├── server/
│   │   ├── app.ts          # Hono app, WebSocket handlers, middleware wiring
│   │   ├── index.ts        # Production server entry — starts @hono/node-server
│   │   ├── db/             # Schema init, typed queries (users, processes, sessions, logs, ai)
│   │   ├── lib/            # Monitor (pidusage/tasklist), crypto (bcrypt/CSRF), TOTP, cron
│   │   ├── middleware/      # auth, csrf, rateLimiter, ipWhitelist, securityHeaders
│   │   ├── routes/         # auth, processes, users, api_tokens, logs, terminal, settings, ai
│   │   ├── types/          # Shared server-side TS interfaces
│   │   └── websocket.ts    # WS broadcast helpers, process stats broadcaster
│   ├── api/                # Typed fetch wrappers used by the React frontend
│   ├── components/         # React UI components (dashboard, AI drawer, terminal, modals)
│   ├── hooks/              # useAuth, useProcesses, useWebSocket
│   ├── pages/              # Route-level views (Dashboard, Users, Logs, Settings, etc.)
│   ├── store/              # Zustand slices (auth, toasts)
│   ├── types/              # Shared client-side TS interfaces
│   └── utils/              # cn (tailwind-merge), uptime helpers
├── dist/                   # Build output (frontend only, generated by `npm run build`)
├── local.db                # SQLite database file (created on first run if using file: URL)
├── vite.config.ts          # Dev: mounts Hono inside Vite. Prod: pure static build.
├── .env.example            # Environment variable template
└── package.json
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts Vite dev server on `:5173` with the Hono backend embedded |
| `npm run build` | Runs `tsc` then `vite build` — outputs static frontend to `dist/` |
| `npm run preview` | Serves the `dist/` folder locally via Vite's preview server (no backend) |

There is no `npm start` or `npm test` script defined in `package.json`.

---

## Troubleshooting

**`node-pty` fails to install or throws on startup**
`node-pty` compiles a native C++ addon. Install build tools first: on Ubuntu/Debian run `apt install build-essential python3`; on Windows install [Windows Build Tools](https://github.com/nodejs/node-gyp#on-windows). Then re-run `npm install`.

**Login returns 401 after setting `SECRET_KEY`**
Sessions signed with the old key are invalid. Clear cookies and log in again. Changing `SECRET_KEY` in production invalidates all active sessions.

**`/api/health` is reachable but the frontend shows a blank page after `npm run build`**
The `dist/` folder contains only static assets. If you are serving `dist/` without the Node.js backend running, all `/api/*` requests return 404. Start the backend (`npx tsx src/server/index.ts`) and ensure the reverse proxy routes `/api/` to it.

**Process shows "running" in the UI but the PID is dead**
On Windows, the monitor checks `tasklist` and validates the executable name against the stored command to prevent PID recycling false-positives. If the executable name does not match (e.g. a wrapper script), the check may fail. Restart the process manually or update the command to use the direct executable.

**Rate limiter returns 429 unexpectedly**
The in-process rate limiter allows 300 requests per minute per IP, using `x-forwarded-for` as the key. Behind a reverse proxy that does not set this header, all traffic may appear to come from a single IP. Configure your proxy to forward the real client IP.

**AI chat says "Forbidden" even though the feature is enabled**
Each permission (e.g. `terminal_unrestricted`, `processes_stop`) must be individually enabled in the AI Permissions panel. These are stored per-user in the `ai_permissions` column and are sent with every chat request. Enabling the AI model setting alone is not sufficient.

---

## Contributing

There are no automated tests and no CI configuration in this repository. Before submitting changes:

1. Run `npm run build` — it must complete with exit code 0 (TypeScript errors fail the build).
2. Test the affected routes manually against a local SQLite database.
3. Do not change `ai_model`, `ai_api_key`, or `ai_base_url` in code — these are runtime settings managed through the UI.

---

## License

Created by [toxichome](https://toxichome.cc). MIT — see [LICENSE](LICENSE). 
