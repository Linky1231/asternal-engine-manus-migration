# Base44 Dev Environment

## What this app is
Asternal Engine — a Vite + React 19 + TanStack Router frontend with an Express backend.
The frontend uses a localStorage-based data client (`src/integrations/manus/data-client.ts`)
that mimics a Supabase API, so it renders standalone without the backend.

## Architecture
- **Frontend**: Vite dev server (port 5173), React 19, TanStack Router, Tailwind v4, Shadcn UI
- **Backend** (not run in Base44): Express server in `server/`, MySQL via Drizzle ORM, Manus OAuth, Manus Forge API for storage/LLM
- **Data**: Frontend uses localStorage adapter (`data-client.ts`); backend uses MySQL + Manus services

## How it runs in Base44
- `docker-compose.base44.yml` runs `node:22-slim` with pnpm, bind-mounting the repo
- Command: `pnpm install --frozen-lockfile && pnpm dev` (vite --host)
- Port 3000 → container 5173
- `allowedHosts: true` in vite.config.ts (was restricted to manus domains)

## External credentials (optional)
The app boots without any credentials. These are only needed for specific features:
- `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL` — Manus OAuth (sign-in)
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — Manus Forge (storage, LLM, heartbeat)
- `DATABASE_URL` — MySQL (backend only)
- `JWT_SECRET` — session signing (backend only)
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe checkout

## Verifying the app
```bash
curl -sf -H "Host: external-preview.example.com" http://localhost:3000/
# Should return the HTML with <title>Asternal Engine</title>
```

## Notes
- README mentions Convex but the code doesn't use it — it's a template leftover
- The `dev` script runs only the frontend; the Express backend has no dev script
- `pnpm-lock.yaml` is v9.0; corepack provides pnpm
