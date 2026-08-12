# Move with Miya

A microservices-based yoga studio management platform.

## Architecture

| Service | Tech | Port | Description |
|---|---|---|---|
| `frontend` | Next.js | 5173 | Client app |
| `backend` | NestJS | 3000 | API gateway |
| `user-service` | Express | 3001 | Auth & user management |
| `classes-service` | Express | — | Class scheduling (event-driven) |
| `registration-service` | Express | — | Class registrations (event-driven) |
| `nginx` | nginx | 80 | Reverse proxy |
| `postgres` | PostgreSQL 16 | 5432 | Databases: `miya_users`, `miya_classes`, `miya_registrations` |
| `redis` | Redis 7 | 6379 | Session store |
| `rabbitmq` | RabbitMQ | 5672 / 15672 | Message broker |

```text
Frontend (port 5173)
  │
  └── /api/*       →  backend:3000
  └── /api/auth/*  →  (nginx →) user-service:3001
                          │
                          ├── classes-service (RabbitMQ)
                          └── registration-service (RabbitMQ)
```

## Prerequisites

- Node.js 20.9+
- Docker + Docker Compose
- Google OAuth credentials (for login)

## Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Web Client:
   - **Authorized redirect URIs**: `http://localhost:5173/api/auth/google/callback`
3. Copy the Client ID and Client Secret

## Environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
SESSION_SECRET=change-me-to-a-random-string
```

The defaults in `.env.example` (including `DATABASE_URL`, `RABBITMQ_*`, `POSTGRES_*`) work for everything else in development.

## Running locally (with hot reload)

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts Redis, Postgres, and RabbitMQ.

### 2. Install dependencies

```bash
npm install
```

This installs root deps (concurrently, eslint, etc.) and runs `postinstall` to install all sub-service deps. It also generates the Prisma client for `user-service` (outputs to `user-service/src/generated/prisma`).

### 3. Generate the Prisma client

This runs automatically during `npm install` (via `postinstall`). If you need to regenerate it manually:

```bash
cd user-service && npx prisma generate
```

### 4. Run database setup

The `init.sql` runs automatically in Postgres on first start. The named `postgres-data` volume persists the database across `docker compose down`, so `init.sql` only runs again after a destructive full reset:

```bash
docker compose down --volumes
docker compose up -d
```

> **Warning:** `docker compose down --volumes` deletes the `postgres-data` volume and destroys all database data. Use it only when you intend to reset everything.

### 5. Start all services

```bash
npm run dev
```

This starts backend (3000), user-service (3001), classes-service, registration-service, and frontend (5173) in parallel with hot reload.

Or start individually in separate terminals:

```bash
cd backend              && npm run start:dev  # port 3000
cd user-service         && npm run start:dev  # port 3001
cd classes-service      && npm run start:dev
cd registration-service && npm run start:dev
cd frontend             && npm run dev        # port 5173
```

### 5. Open the app

Navigate to `http://localhost:5173`.

## Useful commands

```bash
npm run lint          # Lint all services
npm run typecheck     # Type-check all services
npm run test          # Run backend tests
npm run audit:fix     # npm audit fix across all services
```

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Requires the following to be set in `.env`:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `RABBITMQ_USER`, `RABBITMQ_PASS`
- `SESSION_SECRET`
- `CORS_ORIGIN`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

Production checklist:

- [ ] Use real, non-development secrets — never placeholders such as `change-me` or `guest`.
- [ ] Set `CORS_ORIGIN` and `GOOGLE_CALLBACK_URL` to real deployment URLs, not `localhost`.
- [ ] Verify `POSTGRES_PASSWORD` and `RABBITMQ_PASS` are unique, strong credentials before exposing the stack publicly.
