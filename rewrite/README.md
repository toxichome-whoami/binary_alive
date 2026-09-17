# Binary Alive v2.0 (Rewrite)
A high-performance, modern process supervisor & remote management system built with **TypeScript**, **Hono**, **Turso (libSQL)**, **Vite**, **React 18**, and **Tailwind CSS**.

---

## Architecture Overview

- **Backend (`/server`)**: TypeScript on Node.js using Hono HTTP framework. Connects to Turso database via `@libsql/client`.
- **Frontend (`/client`)**: Vite + React 18 + Tailwind CSS SPA with a Cloudflare-inspired dark/light interface.
- **Database**: Serverless SQLite via Turso with database-backed sessions and audit tracking.
- **Cron (`cron.php`)**: Lightweight PHP CLI trigger for standard cPanel cron scheduling that notifies the Node.js server.

---

## Directory Structure

```
rewrite/
├── server/                   # TypeScript Node.js Backend
│   ├── src/
│   │   ├── db/               # Turso database connection, schema, and typed queries
│   │   ├── lib/              # Process monitor, crypto (AES-256-GCM), TOTP, captcha, config
│   │   ├── middleware/       # Auth, CSRF double-submit, rate limiting, security headers
│   │   ├── routes/           # REST endpoints (auth, processes, users, logs, terminal, settings)
│   │   └── index.ts          # Server entrypoint and embedded cron supervisor
│   ├── package.json
│   └── tsconfig.json
│
├── client/                   # Vite + React 18 + Tailwind CSS Frontend
│   ├── src/
│   │   ├── api/              # Typed fetch API client modules
│   │   ├── components/       # Layout (Sidebar, TopBar), UI (Buttons, SlideOver, Dialogs)
│   │   ├── hooks/            # useAuth, useProcesses (live polling + 1s ticker)
│   │   ├── pages/            # Login, Dashboard, Terminal, Users, Logs, Settings, Setup2FA
│   │   ├── store/            # Zustand auth and toast state
│   │   ├── types/            # Shared TypeScript interfaces
│   │   ├── utils/            # cn (Tailwind merge), uptime helpers
│   │   ├── App.tsx           # HashRouter with Auth and Role guards
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── cron.php                  # cPanel CLI cron trigger
├── package.json              # Workspace root runner
└── .env.example              # Environment variables template
```

---

## Local Development Setup

### 1. Prerequisites
- **Node.js 18+** installed on your system.
- A **Turso** database URL & token (or omit to use local SQLite `file:local.db`).

### 2. Install Dependencies
From the `rewrite/` directory:
```bash
# Install root workspace dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```
Fill in your Turso credentials (or leave `TURSO_URL=file:local.db` for local testing).

### 4. Run Development Servers
From the `rewrite/` root directory:
```bash
npm run dev
```
- Backend starts at `http://localhost:3000`
- Frontend starts at `http://localhost:5173` (with `/api` proxy to `:3000`)

---

## Production Build & cPanel Deployment

### 1. Build Both Workspaces
```bash
npm run build
```
- Compiles server TypeScript into `server/dist/`
- Compiles client React into `client/dist/`

### 2. cPanel Deployment
1. **Setup Node.js App in cPanel**:
   - Navigate to **cPanel** -> **Setup Node.js App**.
   - Node version: **18** or **20**.
   - Application root: `apps/binary-alive/server`.
   - Application startup file: `dist/index.js`.
   - Add environment variables (`TURSO_URL`, `TURSO_TOKEN`, `SECRET_KEY`, `CRON_SECRET`, `PORT=3000`).
   - Click **Create** and **Start**.

2. **Deploy Frontend Web Files**:
   - Copy everything from `client/dist/*` into your target public folder (e.g. `public_html/watch/`).
   - Create or update `.htaccess` in `public_html/watch/`:
     ```apache
     RewriteEngine On

     # Proxy API calls to Node.js backend port
     RewriteRule ^api/(.*)$ http://localhost:3000/api/$1 [P,L]

     # Serve static index.html for SPA hash routing
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteRule ^ index.html [L]
     ```

3. **Configure cPanel Cron Job**:
   - Go to **cPanel** -> **Cron Jobs**.
   - Schedule: `Once Per Minute (* * * * *)`.
   - Command:
     ```bash
     /usr/local/bin/php /home/username/apps/binary-alive/cron.php
     ```

---

## Security Features

- **Role-Based Access Control (RBAC)**: Master Admin, Admin, Operator, Auditor, Viewer.
- **Master Admin Protection**: User ID 1 cannot be demoted, deleted, or altered by other admins.
- **Two-Factor Authentication (2FA)**: TOTP verification via authenticator apps with secrets encrypted using AES-256-GCM.
- **CSRF Defense**: Double-submit cookie pattern with secure headers.
- **Brute-Force Rate Limiting**: Automatic IP lockout after 5 consecutive failed login attempts.
- **Live CAPTCHA**: Lightweight SVG captcha generated on the server with real-time validation.
- **Session Security**: Database-backed sessions stored in Turso with `HttpOnly; Secure; SameSite=Strict` cookies.
- **Audit Trails**: Every command, process restart, user update, and login attempt is recorded in immutable audit tables.
