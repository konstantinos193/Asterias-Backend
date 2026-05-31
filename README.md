# Asterias Homes — Backend API

<p align="center">
  <img src="public/asterias-logo.avif" alt="Asterias Homes" width="200" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-blue-green-2496ED?style=flat-square&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Stripe-Live-635BFF?style=flat-square&logo=stripe&logoColor=white" />
</p>

REST API for the Asterias Homes hotel booking platform. Built with NestJS, MongoDB, and deployed via Docker blue-green releases on every push to `main`.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Database | MongoDB + Mongoose |
| Auth | JWT + Passport (local + jwt strategies) |
| Payments | Stripe |
| Email | Nodemailer (Gmail SMTP) |
| Images | Cloudinary + Sharp |
| PDF | Puppeteer (Chromium) |
| Scheduling | `@nestjs/schedule` + node-cron |
| Channel sync | iCal export / Booking.com webhooks |
| API docs | Swagger (`/api/docs`) |

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- MongoDB (local or Atlas)

### Setup

```bash
git clone https://github.com/konstantinos193/asterias-backend.git
cd asterias-backend
pnpm install
cp .env.production.example .env
# fill in .env with your local values
pnpm run dev
```

Server starts on `http://localhost:5000`.  
Swagger docs at `http://localhost:5000/api/docs`.  
Health check at `http://localhost:5000/health`.

---

## Environment variables

Copy `.env.production.example` and fill in the values:

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_REFRESH_SECRET` | JWT refresh token secret |
| `FRONTEND_URL` | Frontend URL for CORS |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `SMTP_HOST` | SMTP host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP app password |
| `ADMIN_EMAIL` | Seed admin email |
| `ADMIN_PASSWORD` | Seed admin password |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `API_KEY` | Internal API key for admin routes |
| `ICAL_EXPORT_TOKEN` | Token protecting iCal export endpoint |
| `BOOKINGCOM_WEBHOOK_SECRET` | Booking.com webhook secret |

---

## Deployment

Pushes to `main` trigger an automated blue-green deployment via GitHub Actions:

1. GitHub Actions SSHs into the VPS
2. `git pull` latest code
3. Docker builds the new image
4. New container starts on the inactive port (5010 or 5011)
5. Health check passes → Nginx upstream switches, zero downtime
6. Old container stops

See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and [`scripts/deploy.sh`](scripts/deploy.sh).

### Required GitHub Secrets

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | SSH private key (ed25519) |

---

## Project structure

```
src/
├── main.ts                  # Bootstrap, global middleware, CORS
├── app.module.ts            # Root module
├── admin/                   # Admin analytics & dashboard
├── auth/                    # JWT + local auth, guards, decorators
├── availability/            # Room availability logic
├── bookings/                # Booking CRUD & status management
├── bookingcom-webhook/      # Booking.com webhook ingestion
├── cloudinary/              # Image upload to Cloudinary
├── common/                  # Shared filters, interceptors, pipes
├── contact/                 # Contact form
├── database/                # Mongoose connection
├── email/                   # Nodemailer templates (EN / EL / DE)
├── health/                  # Health check endpoint
├── images/                  # Local image management
├── models/                  # Mongoose schemas
├── offers/                  # Promotions & discount codes
├── payments/                # Stripe payment intents & webhooks
├── pdf/                     # Puppeteer PDF generation
├── reviews/                 # Guest reviews
├── rooms/                   # Room management
├── scheduled-tasks/         # Cron jobs (reminders, sync)
├── settings/                # App-wide settings
├── translations/            # i18n
└── users/                   # User management
```

---

## API overview

All routes are prefixed with `/api` except `/health`.

| Module | Base path |
|---|---|
| Auth | `/api/auth` |
| Rooms | `/api/rooms` |
| Bookings | `/api/bookings` |
| Payments | `/api/payments` |
| Availability | `/api/availability` |
| Offers | `/api/offers` |
| Reviews | `/api/reviews` |
| Contact | `/api/contact` |
| Channel manager | `/api/channel-manager` |
| Admin | `/api/admin` |
| Images | `/api/images` |
| Booking.com | `/api/bookingcom-webhooks` |

Full interactive docs available at `/api/docs` (Swagger UI).

---

## License

MIT
