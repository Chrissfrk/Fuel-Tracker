# Fuel Tracker

A self-hosted Progressive Web App for tracking the family cars: fill-ups, mileage, fuel costs,
other car expenses, budgets and service reminders. It runs as **one Docker container on one
port**, installs on iPhone and Android home screens, and works **offline at the pump**. Entries
made without a connection sync when it comes back.

Built for Greece: km, liters and €, dates as `dd/mm/yyyy`, amounts as `71,30 €`, and number
fields accept both `41,2` and `41.2`. The interface is in English.

---

## Features

- **Fast logging at the pump.** A bottom sheet with Fill-up, Expense and Odometer tabs. Price per
  liter is calculated as you type. The decimal keypad opens, and "Next" moves to the next field.
  Gentle sanity warnings (for example "This is a lot more than your tank holds") come with a
  **Save anyway** button. Every save can be undone.
- **Correct fuel economy** using the full-tank method. Partial fills count toward costs but get no
  economy figure of their own, and segments with a missed fill-up are left out. Averages always
  divide totals and never average ratios.
- **Dashboard.** This month's fuel spend with ▲/▼ vs last month, km, L/100 km, €/L, true cost per
  km, a budget ring, projections ("At this pace: ~142 € this month · ~1.690 € this year"), upcoming
  reminders, the estimated odometer and recent fill-ups.
- **History** of every fill-up, expense and odometer reading, grouped by month with totals. Filter
  by car, type, category, family member or date, and search notes and stations. Swipe left to
  delete (with undo), tap to edit.
- **Stats.** A monthly table with comparison arrows and charts: economy per tank with a rolling
  average, price per liter, monthly spending (stacked), km per month, seasonal economy (the A/C
  effect in summer), spending by category, and a station price comparison. Also all-time records
  and totals for one car or the whole household.
- **Service reminders** with presets for Oil & filter, Tire rotation, KTEO, Insurance renewal,
  Road tax (τέλη κυκλοφορίας), Timing belt and Brake check. Each one is due by km, by months or on
  a fixed date. Statuses are worked out from the estimated odometer and your recent km per day.
  Marking a reminder done can log the matching expense.
- **Budgets** per car and for the household, shown as green / amber / red, always with an icon and
  a label as well.
- **Family accounts.** The admin manages users and car access. Members log for the cars they can
  use, can add cars and reminders, and edit only what they logged. Every record shows who logged it.
- **Receipt photos** are compressed in the browser before upload (longest side 1600 px, WebP).
- **Export and import.** CSV (a zip with one file per record type), full JSON backup and restore,
  and a paste importer for old fill-ups with a preview before anything is saved.
- **Offline-first.** The app shell is precached. Data lives in IndexedDB and every write goes
  through an outbox that syncs in order, with retries. A small status line shows "Synced ✓",
  "2 changes waiting to sync" or "Offline".
- **Native feel.** Large titles that shrink on scroll, translucent bars, spring animations that
  can be interrupted mid-motion, light and dark mode, reduced-motion support and VoiceOver labels.

## How it's built

```
packages/shared   zod schemas, types, formatting/parsing, and ALL calculation logic (src/calc.ts)
apps/server       Fastify + SQLite (better-sqlite3 + Drizzle), auth, sync API, serves the PWA
apps/web          Vite + React + TypeScript PWA (Dexie, TanStack Query, Chart.js, Tailwind)
e2e               Playwright end-to-end tests
```

Notes on the design:

- **Sync.** Every server row gets a `rev`, a change number that only goes up.
  `GET /api/sync?since=<rev>` returns everything that changed after that number, including soft
  deletes. `POST /api/sync/push` applies queued writes with last-write-wins on `updatedAt`. Using
  a change number instead of a timestamp means a phone with the wrong clock can never miss an
  update. The server always sets who created a record and when.
- **One local database per user.** Each user gets their own IndexedDB on the device, so a shared
  family phone never mixes two people's data. Logging out clears it.
- **Projections.** The month projection extrapolates _fuel_ at the current pace, then adds other
  expenses as they are. One-off bills such as insurance would otherwise be multiplied by the days
  left in the month. In the first 6 days of a month the 3-month average is used instead.

---

## Local development

Requires **Node 22+**.

```bash
npm install
cp .env.example .env                                    # then set a real SESSION_SECRET:
sed -i '' "s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -base64 48)|" .env   # (macOS sed)
sed -i '' "s|^DATA_DIR=.*|DATA_DIR=./.data|" .env
npm run seed      # optional: demo household (nikos / demo1234 as admin, maria / demo1234 as member)
npm run dev       # API on :3000, app on http://localhost:5173 (proxies /api)
```

Other scripts:

| Command                               | What it does                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `npm test`                            | Vitest: calc.ts unit tests + API route tests                                    |
| `npm run test -- --coverage`          | Same, with coverage                                                             |
| `npm run e2e`                         | Builds, then runs the Playwright end-to-end tests against the production server |
| `npm run build`                       | Builds shared → web → server                                                    |
| `npm start`                           | Runs the built server (serves the PWA too)                                      |
| `npm run lint` / `npm run format`     | ESLint / Prettier                                                               |
| `npm run db:generate -w @fuel/server` | New Drizzle migration after changing `apps/server/src/db/schema.ts`             |

The first time you run the e2e tests: `npx playwright install chromium`.

Migrations run automatically when the server starts.

---

## Running with Docker

```bash
cp .env.example .env
# Edit .env: set SESSION_SECRET (openssl rand -base64 48). Keep DATA_DIR=/data.
docker compose up -d
```

Open `http://<server>:3000` and create the admin account. That's it.

- All data lives in the `fuel-data` volume at `/data`: `app.db` (SQLite, WAL mode), `uploads/`
  (receipt photos) and `backups/`. Data survives restarts and upgrades.
- The container runs as a non-root user, has a `HEALTHCHECK` on `/api/health`, and restarts
  unless stopped.
- The server refuses to start without a `SESSION_SECRET` of at least 32 characters.
- To load the demo data into the container (only on an empty database):
  `docker compose exec app node apps/server/dist/seed.js`

### Portainer

Use [portainer-stack.yml](portainer-stack.yml). It reads its settings from Portainer's
environment variables, so there is no `.env` file.

1. **Stacks → Add stack**, give it a name (e.g. `fuel-tracker`) and choose **Repository**.
2. Repository URL `https://github.com/Chrissfrk/Fuel-Tracker`, reference `refs/heads/master`,
   compose path `portainer-stack.yml`. For a private repo, turn on **Authentication** and use your
   GitHub username with a personal access token that can read the repo.
3. Under **Environment variables** add `SESSION_SECRET` (`openssl rand -base64 48`). Optional:
   `HOST_PORT` (default `3000`), `TZ`, `COOKIE_SECURE`.
4. **Deploy the stack.** The first build takes a few minutes. Then open `http://<server>:3000`.

The data lives in the volume `fuel-tracker-data`. To update, open the stack and click **Pull and
redeploy**. Behind a reverse proxy such as Nginx Proxy Manager, leave `COOKIE_SECURE=auto` and make
sure the proxy sends `X-Forwarded-Proto`.

### Environment variables

| Variable         | Default         | Meaning                                                                                                    |
| ---------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET` | – (required)    | Signs session cookies. ≥ 32 characters.                                                                    |
| `PORT`           | `3000`          | Port inside and outside the container.                                                                     |
| `TZ`             | `Europe/Athens` | Timezone for "today", months and the 03:00 nightly backup.                                                 |
| `DATA_DIR`       | `/data`         | Database, photos, backups.                                                                                 |
| `COOKIE_SECURE`  | `auto`          | `auto` = secure cookies when the request came over HTTPS (also behind a proxy). `true` / `false` to force. |

---

## HTTPS (needed to install the app)

Service workers and "Add to Home Screen" only work over **HTTPS** (or on `localhost`). Pick one of
these.

### Option A: Tailscale (family-only, nothing exposed to the internet)

1. Install [Tailscale](https://tailscale.com) on the server and on each family phone, all signed
   in to the same tailnet.
2. In the Tailscale admin console, enable **MagicDNS** and **HTTPS certificates**.
3. On the server:
   ```bash
   sudo tailscale serve --bg 3000
   ```
4. Open `https://<server-name>.<your-tailnet>.ts.net` on each phone.

Only devices in your tailnet can reach the app. Leave `COOKIE_SECURE=auto`.

### Option B: Caddy on your own domain (automatic Let's Encrypt)

1. Point a DNS record (e.g. `fuel.example.com`) at the server and open ports 80 and 443.
2. `cp Caddyfile.example Caddyfile` and put your domain in it.
3. Uncomment the `caddy` service and its volumes in `docker-compose.yml`. Optionally remove the
   `ports` of `app` so it's only reachable through Caddy.
4. `docker compose up -d`, then open `https://fuel.example.com`.

The login endpoint is rate-limited, security headers are set (CSP, HSTS when `COOKIE_SECURE=true`),
uploads are size-limited, and the API only accepts same-origin requests.

---

## Installing the app on phones

**iPhone (Safari):** open the HTTPS address, tap **Share** → **Add to Home Screen** → **Add**. It
opens full-screen with its own icon and splash screen. Log in once while online; after that it
opens and accepts fill-ups offline.

**Android (Chrome):** open the HTTPS address and tap **Install** on the banner, or use the ⋮
menu → **Install app**.

When a new version is deployed, the app shows _"New version available. Tap to reload."_

---

## Backups and restore

- **Automatic:** every night at 03:00 (server time) the server writes an online SQLite backup to
  `/data/backups/app-YYYY-MM-DD.db` and keeps the last **14**. Admins can also trigger one with
  `POST /api/admin/backups`.
- **Manual export:** More → Export & import → _Download JSON backup_ (or CSV for spreadsheets).

**Restore from a JSON backup** (merges, and newer changes win): More → Export & import → _Restore
JSON backup_ (admin). Works on a fresh install after creating the admin account.

**Restore a nightly SQLite backup** (replaces everything):

```bash
docker compose stop app
docker run --rm -v gasapp_fuel-data:/data alpine \
  sh -c 'cp /data/backups/app-2026-10-18.db /data/app.db && rm -f /data/app.db-wal /data/app.db-shm'
docker compose start app
```

(Compose names the volume `<project folder>_fuel-data`, e.g. `gasapp_fuel-data` for a folder called "Gas App". Check it with `docker volume ls`.)

Copy backups off the server now and then, e.g.
`docker cp fuel-tracker:/data/backups ./fuel-backups`.

---

## Updating to a new version

```bash
git pull
docker compose up -d --build
```

Database migrations run automatically on start, and data in the volume is kept. Phones pick up the
new version on their next visit and offer to reload.

---

## Troubleshooting

- **"SESSION_SECRET is missing"**: set it in `.env` (at least 32 characters).
- **Can't install on iPhone / no offline mode**: you're on plain `http://`. Use Tailscale or Caddy.
- **Logged in but nothing syncs behind a proxy**: make sure the proxy passes `X-Forwarded-Proto`.
  Caddy and `tailscale serve` both do.
- **Forgot the admin password**: another admin can reset it under More → Family members. If you
  were the only admin, restore from a backup or reset it in the database with a fresh argon2 hash.
