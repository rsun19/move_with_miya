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

```
Frontend (port 5173)
  │
  └── /api/*       →  backend:3000
  └── /api/auth/*  →  (nginx →) user-service:3001
                          │
                          ├── classes-service (RabbitMQ)
                          └── registration-service (RabbitMQ)
```

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Google OAuth credentials (for login)

## Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Web Client:
   - **Authorized redirect URIs**: `http://localhost:3001/auth/google/callback`
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

The defaults in `.env.example` work for everything else in development.

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

This installs root deps (concurrently, eslint, etc.) and runs `postinstall` to install all sub-service deps.

### 3. Run database setup

The `init.sql` runs automatically in Postgres on first start. If you need to re-run it:

```bash
docker compose down
docker compose up -d
```

### 4. Start all services

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

Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET` to be set in `.env`.
