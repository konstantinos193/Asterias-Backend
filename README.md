# Asterias Homes, Backend API

<p align="center">
  <img src="public/asterias-logo.avif" alt="Asterias Homes" width="200" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-12-E0234E?style=flat-square&logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-7.0-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node-20_slim-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Mongoose-9-47A248?style=flat-square&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Stripe-live_money-635BFF?style=flat-square&logo=stripe&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/deploy-blue%2Fgreen-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/registry-ghcr.io-181717?style=flat-square&logo=github&logoColor=white" />
  <img src="https://img.shields.io/badge/edge-nginx_or_Traefik-009639?style=flat-square&logo=traefik&logoColor=white" />
  <img src="https://img.shields.io/badge/PDFs-Puppeteer-40B5A4?style=flat-square&logo=puppeteer&logoColor=white" />
  <img src="https://img.shields.io/badge/images-Cloudinary-3448C5?style=flat-square&logo=cloudinary&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/routes-140-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/modules-24-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/controllers-15-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/emails-EL_%7C_EN_%7C_DE-informational?style=flat-square" />
  <img src="https://img.shields.io/badge/tests-3_verify_scripts-yellow?style=flat-square" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/ts--node-deceased-critical?style=flat-square" />
  <img src="https://img.shields.io/badge/nest_start-also_deceased-critical?style=flat-square" />
  <img src="https://img.shields.io/badge/license-not_MIT_actually-red?style=flat-square" />
  <img src="https://img.shields.io/badge/guests-real-success?style=flat-square" />
</p>

REST API for Asterias Homes, a seven apartment property in Koronisia, Arta. It
takes bookings, charges cards, emails guests in three languages, prints PDF
confirmations, and refuses to double sell the same room on the same night.

That last part sounds like table stakes. It took a while.

The property is small enough that there is no on call rotation and no staging
environment. There is one VPS, one Mongo cluster, and an owner who notices
within the hour when something is wrong. Keep that in mind before you push.

---

## Stack

| Layer | What it actually is |
|---|---|
| Framework | NestJS 12 |
| Language | TypeScript 7, strict |
| Database | MongoDB via Mongoose 9 |
| Auth | Passport, local plus JWT, with an admin guard that fails closed |
| Rate limiting | `@nestjs/throttler`, two tiers, actually bound as a global guard |
| Payments | Stripe 23, card and cash on arrival |
| Email | Nodemailer over Gmail SMTP, templates in Greek, English and German |
| Images | Cloudinary, with Sharp for local processing |
| PDF | Puppeteer against the distro Chromium, not a bundled Chrome |
| Scheduling | `@nestjs/schedule` only, there is no `node-cron` in here |
| Channels | Booking.com webhook ingestion. Inbound only |
| API docs | Swagger at `/api/docs`, development only |

Two entries in that table used to say something else, so to be explicit:

**There is no iCal export.** Not a broken one, not a disabled one. No code.
`ICAL_EXPORT_TOKEN` sits in both env examples guarding an endpoint that was
never written. **There is no channel manager API** either. `/api/channel-manager`
has never existed in this repo. Booking.com can push to us and that is the
whole of it.

---

## The response envelope

Every successful response is wrapped by a global interceptor:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": { "the thing you actually wanted": true },
  "timestamp": "2026-10-26T12:00:00.000Z"
}
```

Your payload is under `data`. Always. This has cost more frontend debugging
hours than any other single line in the codebase, because a `fetch().then(r =>
r.json())` that forgets to unwrap gets an object that is truthy, has the right
shape at a glance, and is wrong. See
[`src/common/interceptors/transform.interceptor.ts`](src/common/interceptors/transform.interceptor.ts).

Errors go through [`http-exception.filter.ts`](src/common/filters/http-exception.filter.ts)
and do not wear the same envelope. Enjoy.

---

## Local development

### Prerequisites

- Node 20 or newer. `engines` still claims 18, the Dockerfile ships 20, trust the Dockerfile
- pnpm (`npm i -g pnpm`). There is a `package-lock.json` in here too. Ignore it, `pnpm-lock.yaml` is the real one
- MongoDB, local or an Atlas connection string

### Setup

```bash
git clone https://github.com/konstantinos193/asterias-backend.git
cd asterias-backend
pnpm install
cp .env.example .env
```

Use `.env.example` for local work. `.env.production.example` is the production
shape, points at live Stripe keys and `asteriashome.gr`, and is not what you
want on a laptop.

### Running it

```bash
pnpm build
node dist/main.js
```

Yes, that is the dev loop. No watcher. Here is why.

`pnpm dev`, `pnpm start` and `pnpm start:dev` all call `nest start`, which dies
immediately:

```
Error  The installed TypeScript version (7.0.2) does not expose the programmatic
compiler API that the Nest CLI requires. TypeScript 7.0 ships the "tsc"
executable only; the compiler API is expected to return in 7.1.
```

`pnpm seed` goes through `ts-node` and dies of the same wound, less politely,
with `TypeError: Cannot read properties of undefined (reading 'fileExists')`
when it reaches for `ts.sys`.

So: anything that drives the compiler through its API is dead here until
TypeScript 7.1 lands, and anything that shells out to `tsc` is fine. `pnpm
build` is a plain `tsc -p tsconfig.json` and compiles clean. Seeding is
`node dist/seed.js` after a build. The broken scripts are still in
`package.json` because removing them would be an admission.

Once it is up:

| What | Where |
|---|---|
| API | `http://localhost:5000/api` |
| Liveness | `http://localhost:5000/health` |
| Swagger | `http://localhost:5000/api/docs` |
| Landing page | `http://localhost:5000/` |

Swagger is mounted only when `NODE_ENV !== 'production'`, so do not go looking
for it on the live host. That was deliberate.

### Tests

There is a `jest` dependency and a `pnpm test` script. There are no Jest tests.

What does exist, and what you should run before touching money or calendars, is
three regression suites written in `node:test` against the compiled output,
precisely so they need no TypeScript toolchain:

```bash
pnpm build
node --test scripts/verify-pricing.js       # stay totals, VAT, room combinations
node --test scripts/verify-availability.js  # the one availability engine
node --test scripts/verify-auth-guards.js   # guards that were missing in production
node scripts/audit-endpoints.js             # reflects over dist, prints every route and its guards
```

Every case in those files is a bug that was live on the real site, charging real
guests the wrong amount or selling a room the owner had closed. They are not
hypotheticals and they are not decorative.

---

## Environment variables

Start from `.env.example`. These are the ones the code actually reads.

### Required

| Variable | Notes |
|---|---|
| `NODE_ENV` | `development` or `production`. Gates Swagger, CORS defaults and the keep alive pinger |
| `PORT` | Defaults to 5000. In Docker the container always listens on 5000 and the host maps 5010 or 5011 |
| `MONGODB_URI` | Read directly at module load, not through `ConfigService`. No URI, no boot |
| `JWT_SECRET` | Signing secret. Generate with `openssl rand -base64 32` |
| `FRONTEND_URL` | Used in email links |
| `STRIPE_SECRET_KEY` | Live key in production. Read it twice before you paste |
| `STRIPE_WEBHOOK_SECRET` | The webhook signature is verified over the raw body, which is why `main.ts` boots with `rawBody: true` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed admin credentials. The seed script aborts rather than invent a password |
| `API_KEY` | Single shared secret for the internal API key guard |

### Email

The email service reads two generations of names and takes whichever it finds,
because a rename was done halfway:

| Variable | Notes |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Current names |
| `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_APP_PASSWORD` | Older names, still read |

Gmail needs an app password, not the account password.

### Cloudinary

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### Optional, and worth knowing about

| Variable | Default | What it does |
|---|---|---|
| `CORS_ORIGINS` | unset | Comma separated allowlist. Unset falls back to the two `asteriashome.gr` origins in production, or localhost 3000 and 3001 outside it. Localhost used to be trusted in production as well, which meant any page that could reach a localhost origin was a trusted caller against the live API |
| `TRUST_PROXY` | `1` | Hops to trust for `X-Forwarded-For`. Without it every request looks like it came from the proxy, so the rate limiter treats the entire internet as one client and a single attacker can lock out every guest at once |
| `NODE_ENABLE_MEMORY_MONITOR` | off | `true` turns on the heap logger. Always on in development |
| `MEMORY_WARNING_THRESHOLD` | `500` | Megabytes before it starts complaining |
| `MEMORY_CHECK_INTERVAL` | `60000` | Milliseconds between checks |
| `BOOKINGCOM_WEBHOOK_SECRET` | unset | Shared secret on the Booking.com webhook |
| `RENDER_EXTERNAL_URL` | an `onrender.com` URL | The keep alive service pings itself in production to stop a host sleeping. This has not been hosted on Render for a long time and nothing sets this, so in production it currently pings a dead Render URL every few minutes. Harmless, embarrassing, on the list |

### Listed in the env examples but read by nothing

- `ICAL_EXPORT_TOKEN`, guarding the iCal endpoint that does not exist
- `JWT_REFRESH_SECRET`, for the refresh token flow that was never built. Access tokens are all there is

Leave them or delete them, but do not assume they protect anything.

---

## API surface

140 route handlers across 15 controllers. Everything is under `/api` except the
liveness probe.

| Module | Base path | What lives there |
|---|---|---|
| Auth | `/api/auth` | Register, login, profile. Both are rate limited, register the harder of the two |
| Rooms | `/api/rooms` | Public listing, quotes, and the `admin/*` subtree for blocks and pricing |
| Bookings | `/api/bookings` | Booking lifecycle, multi room bookings, room combination search |
| Payments | `/api/payments` | Stripe intents, checkout sessions, the webhook, cash on arrival requests |
| Availability | `/api/availability` | Per room, per date, monthly, calendar and overview reads |
| Offers | `/api/offers` | Promotions, discount code validation |
| Reviews | `/api/reviews` | Guest reviews, Google import, featuring and responses |
| Contact | `/api/contact` | Contact form, capped at 3 per minute |
| PDF | `/api/pdf` | Puppeteer rendered booking confirmations |
| Images | `/api/images` | Cloudinary upload, fetch, delete. Not local storage, despite the folder name |
| Users | `/api/users` | User reads and last login bookkeeping |
| Admin | `/api/admin` | Dashboard, analytics, revenue, occupancy, bookings, rooms, offers, seasonal pricing, settings |
| Admin calendar | `/api/admin/calendar` | The booking grid: reservations, assignments, closures, rates, revisions |
| Booking.com | `/api/bookingcom-webhooks` | Inbound notifications only |
| Health | see below | |

### Health endpoints, and the prefix trap

`setGlobalPrefix('api', { exclude: ['health'] })` excludes exactly the string
`health`, not the subtree. The result is a split that surprises everyone once:

| Endpoint | Auth |
|---|---|
| `GET /health` | public, and deliberately boring |
| `GET /api/health/database` | admin only |
| `GET /api/health/stripe` | admin only |
| `GET /api/health/details` | admin only |

The three admin ones were public. `/health` reported uptime and a full memory
breakdown, which tells an attacker exactly when the process restarted and how it
is handling load. `/health/database` handed out the database host and name.
`/health/stripe` published the property's available and pending Stripe balance,
to anyone who asked, on an unauthenticated URL. That is the owner's cash
position. It is behind a guard now, and `/health` returns a status and a
timestamp and nothing else.

Note that `/api/health/details` still reports `version: '1.0.1'` while
`package.json` says `1.2.0`. Nobody has been brave enough to decide which one is
lying.

### Rate limiting

Two named tiers in `app.module.ts`: `default` at 100 requests per minute and
`strict` at 200 per 15 minutes. Sensitive routes ask for both tiers at once, so a
burst is capped per minute and a slow drip is capped over the longer window:

| Route | Per minute | Longer window |
|---|---|---|
| `POST /api/auth/register` | 3 | 10 per hour |
| `POST /api/auth/login` | 5 | 20 per 15 min |
| `POST /api/contact` | 3 | 10 per 15 min |
| `POST /api/payments/request-cash-booking` | 3 | 3 per 15 min |
| `GET /api/pdf/booking-confirmation/:id` | 3 | 15 per 15 min |
| Stripe intent and checkout session | 10 | 50 per 15 min |

Worth knowing: `ThrottlerModule.forRoot()` only configures this. For a long
time nothing bound `ThrottlerGuard` as an `APP_GUARD`, so every limit in the
codebase, including the one on login, was a comment with syntax highlighting.
The login endpoint accepted unlimited password guesses. The binding is in
`app.module.ts` now. Do not remove it to "simplify the providers array".

### Input handling

`MongoSanitizePipe` runs before `ValidationPipe`, in that order, on purpose. The
validator can only whitelist DTO shaped input, so handlers with an untyped body
or query were taking raw Mongo operators. The sanitizer refuses them first,
typed or not.

---

## Deployment

Push to `main`, and [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
does the rest. Two jobs:

**Build.** A GitHub runner builds the image and pushes it to
`ghcr.io/konstantinos193/asterias-backend`, tagged with the run number plus
`latest`. The layer cache lives in GitHub Actions cache, which is why the VPS no
longer compiles anything.

That job pushes the image twice if it has to. ghcr intermittently answers a blob
HEAD during layer push with a bare 403, minutes after the same layers pushed
cleanly with the same token. It is registry side, there is no fix on our end,
and the retry costs seconds because the builder still holds every layer.

**Deploy.** SSH into the VPS, `git reset --hard origin/main`, then
[`scripts/deploy.sh <image>`](scripts/deploy.sh), which pulls the prebuilt image
and performs the cutover:

1. Take a `flock` on `/var/lock/asterias-deploy.lock`. GitHub's concurrency
   group queues workflow runs, but not a manual deploy from someone's shell, and
   two overlapping cutovers will fight over the upstream file and leave the
   proxy pointed at a container the other run already stopped
2. Read `.active-color`, pick the idle one. Blue is port 5010, green is 5011
3. Pull the image, three attempts with backoff. If it cannot pull, stay on the
   current colour and exit non zero
4. Retag it locally and `docker compose --profile <colour> up -d`
5. Poll `127.0.0.1:<port>/health` for up to 120 seconds. If it never comes up,
   dump the container logs, tear the new colour down, stay where we are
6. Repoint the edge proxy, detecting which one is running rather than assuming
7. Write the new colour to `.active-color`, stop the old container
8. Prune old image tags, keeping the newest three so a rollback is one retag

Deploys never cancel in flight. A cancel can land after the old container is
stopped and before the proxy is repointed, which serves 502s to real guests
until a human notices.

### The edge proxy is not ours alone

That VPS runs four unrelated projects behind one `:80` and `:443`. Asterias has
5010 and 5011; the others sit on their own ports. `deploy.sh` therefore detects
whether `nginx` or `traefik` is live and writes the matching config, so it keeps
working before, during and after the Traefik conversion, and keeps working if
that conversion has to roll back.

The two paths differ in an important way. nginx gets `nginx -t` before a reload,
and a bad file is restored rather than left on disk, because nginx would refuse
to restart later. Traefik has no `-t` and no reload signal: the file provider
picks up changes on write, so the new config is written to a temp file and
`mv`ed into place, since a partial write would be read mid save. A malformed
file is rejected in process and Traefik keeps serving the old config, so the
check afterwards confirms the new port is really being served rather than
validating syntax.

Read [`traefik/README.md`](traefik/README.md) before touching any of it. It is
a whole box conversion with CrowdSec in the middle, and the traps are documented
there.

### GitHub secrets

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS address |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | SSH private key, ed25519 |

Registry auth uses the workflow's own `GITHUB_TOKEN`. Nothing to configure.

### On the VPS

The repo lives at `/root/asterias-backend` and the containers read
`.env.production` from there, via `env_file` in
[`docker-compose.yml`](docker-compose.yml). That file is not in git and is not
in any example. If you rotate a secret, rotate it there, then deploy, because
nothing reloads env on its own.

---

## Project structure

```
src/
├── main.ts                  # Bootstrap: helmet, CORS, trust proxy, pipes, prefix, Swagger
├── app.module.ts            # Root module. The APP_GUARD binding lives here
├── seed.ts                  # Super admin seed. Run the compiled dist/seed.js
├── admin/                   # Dashboard, analytics, revenue, occupancy, settings
├── admin-calendar/          # The booking grid: reservations, closures, rates, revisions
├── auth/                    # Passport strategies, guards, decorators
├── availability/            # The single availability engine, rules, revisions
├── pricing/                 # PricingService. The only thing allowed to price a stay
├── bookings/                # Booking lifecycle and multi room search
├── payments/                # Stripe intents, sessions, webhook, cash bookings
├── offers/                  # Promotions and discount codes
├── bookingcom-webhook/      # Inbound Booking.com notifications
├── rooms/                   # Room CRUD, blocks, quotes
├── reviews/                 # Guest reviews and Google import
├── contact/                 # Contact form
├── users/                   # User reads
├── email/                   # Nodemailer service
├── translations/            # Email copy in Greek, English and German
├── pdf/                     # Puppeteer confirmations
├── images/                  # Cloudinary upload and delete
├── cloudinary/              # Cloudinary client
├── settings/                # App settings, served through /api/admin/settings
├── scheduled-tasks/         # Cron jobs
├── keep-alive/              # Self pinger. See the RENDER_EXTERNAL_URL note above
├── health/                  # Liveness plus the admin only detail endpoints
├── database/                # Mongoose connection
├── models/                  # Mongoose schemas
├── common/                  # Global filter, response interceptor, pipes
└── utils/                   # Memory monitor, plus some .js files predating the TypeScript port
```

`src/models/` holds ten TypeScript schemas and one `Booking.js`. There are also
loose `.js` files in `utils/` and `translations/`. They are survivors of the
JavaScript era, still imported, and not worth converting unless you are already
in there.

### Scheduled tasks

All in [`scheduled-tasks.service.ts`](src/scheduled-tasks/scheduled-tasks.service.ts),
all through `@nestjs/schedule`:

| Schedule | Job |
|---|---|
| Hourly | `handleArrivalReminders` |
| Hourly | `handlePostCheckoutEmails` |
| Every 30 minutes | `handleSystemHealthCheck` |
| 09:00 and 18:00 daily | `handleInventoryChecks`, which alerts on low availability |
| Midnight daily | `handleDailyCleanup`, which clears notification flags |
| 30 seconds after boot | `handleInitialChecks`, a one shot `@Timeout` |

There is also `runTaskManually(taskName)` plus `triggerReminderCheck` and
`triggerInventoryCheck`, for when you need a job to run now and do not want to
wait for the hour to turn.

They are started explicitly from `main.ts` and stopped on `SIGTERM` and
`SIGINT`, so a blue/green cutover does not leave two processes sending the same
reminder email to the same guest. Twice.

---

## Things that will bite you

In rough order of how much time each one has cost someone.

**The `data` wrapper.** Covered above. Unwrap it.

**`t()` returns the key on a miss.** On the frontend side of this project, a
missing translation key returns the key itself, which is a truthy string, which
means `t(key) || "fallback"` never reaches the fallback. Every such fallback in
the codebase is dead code. Mentioned here because the email translations in
`src/translations/` feed the same habit.

**`nest` and `ts-node` are both out of action.** Build, then run `dist`.

**Do not kill node by image name.** On the dev machine this repo shares a box
with several other Node projects. `taskkill /im node.exe` takes down whatever
else was running, including the thing you were about to compare against. Find
the PID holding the port and kill that one.

**Two env files, two different worlds.** `.env.production.example` carries live
Stripe keys and the production origins. It is not a local template.

**`MONGODB_URI` is read at module load**, not through `ConfigService`, so a
missing or malformed URI fails at import time with a less helpful error than you
would like.

**Stripe webhooks need the raw bytes.** The app boots with `rawBody: true` for
exactly this. Any middleware that consumes or re transforms the body before the
webhook handler breaks signature verification, and it breaks it silently in the
sense that every event starts returning 400 and payments stop being confirmed.

**The seed script will not invent an admin password.** It aborts without
`ADMIN_PASSWORD`. This is on purpose.

---

## Conventions

- `PricingService` is the only thing allowed to work out what a stay costs.
  Nothing else multiplies nights by `room.price`. The reason is in
  `scripts/verify-pricing.js`: two code paths once disagreed, so the search
  showed one number and checkout charged another, and separately VAT was being
  added on top of rates that already included it
- There is one availability engine, in `src/availability/`. The guest date
  picker, the room listing, the booking time guard and the admin grid all read
  it. They used to each have their own opinion, which is how the owner closed an
  apartment, watched the admin calendar go grey, and found the public site still
  selling those nights
- `AdminGuard` fails closed. If it cannot establish that the caller is an admin,
  the answer is no
- Email copy exists in Greek, English and German. If you touch one, touch all
  three
- No emoji in guest facing copy. The console logs are a different matter and
  that ship has sailed

---

## License

Not MIT. The previous README said MIT and that was simply wrong.

This is commissioned work. The site and this API were built for the property by
**Adinfinity**, an advertising and digital agency in Arta operating since 2013,
which lists the project publicly as
[asterias-koronisia](https://adinfinity.gr/projects/asterias-koronisia) and
whose own footer reads "all rights reserved".

So: **proprietary, all rights reserved.** Not open source, no grant of reuse,
no redistribution. It runs one hotel, it contains that hotel's pricing logic and
operational detail, and there is nothing in here anyone would want to vendor
anyway.

There is no `LICENSE` file in the repo and `package.json` still declares
`"license": "MIT"`. Both should be corrected by whoever has the authority to say
so in writing, which is not this README.

- Agency: [adinfinity.gr](https://adinfinity.gr), info@adinfinity.gr
- Live site: [asteriashome.gr](https://asteriashome.gr)
- Frontend repo: [`../asterias-homes`](../asterias-homes)

---

Real guests, real cards, one server. Build before you run, run the verify
scripts before you touch money or calendars, and do not deploy on a Friday
evening in August.
