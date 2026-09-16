# Plan 4: Production Configuration, Deployment, and Operations

## Goal

Make the application deployable and supportable in production with validated configuration, HTTPS, safe secrets, reliable migrations, backups, observability, and a repeatable rollback path.

## Current state

- Production Docker Compose definitions exist for the five application services and infrastructure.
- Several production secrets and URLs are passed through environment variables.
- nginx exposes ports 80 and 443, but the production config only listens for HTTP on port 80.
- Healthchecks exist for Redis, Postgres, and RabbitMQ, but not for the application services.
- Migrations run inside service containers at startup.
- The backend exposes only a basic root health response.
- There is CI for install, lint, typecheck, build, unit tests, and backend E2E tests, but no deployment or rollback workflow.

Relevant files:

- `docker-compose.prod.yml`
- `nginx/nginx.prod.conf`
- `.env.example`
- `README.md`
- `.github/workflows/ci.yml`
- `backend/src/app.controller.ts`
- `backend/src/main.ts`

## Phase 1: Configuration contract

Create a documented production configuration matrix. Required values should include:

### Core infrastructure

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `RABBITMQ_USER`
- `RABBITMQ_PASS`
- `REDIS_URL`
- `SESSION_SECRET`
- `NODE_ENV=production`

### Public URLs and auth

- `CORS_ORIGIN`
- `PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `NEXT_PUBLIC_AUTH_URL`

### Contact protection and email

- `CONTACT_CHALLENGE_SECRET`
- `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_HOSTNAME`
- `RESEND_API_KEY`
- `CONTACT_EMAIL_TO`
- `RESEND_FROM_EMAIL`

### Payments

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CURRENCY`

Add runtime validation to each service that owns a variable. Production should fail fast for missing or placeholder values such as `change-me`, `guest`, `localhost`, or `example.com`. Development may retain safe defaults only when `NODE_ENV !== production`.

Do not commit real secrets. Prefer a platform secret manager or Docker secrets over a plaintext production `.env` file.

## Phase 2: Domain and provider setup

Before deployment:

1. Point the production domain and `www` behavior to the reverse proxy.
2. Create a real TLS certificate, preferably through the hosting platform or an automated ACME client.
3. Register the exact HTTPS Google OAuth callback URL.
4. Create a production Turnstile site and restrict its hostname.
5. Verify the Resend sending domain and configure SPF, DKIM, and DMARC.
6. Register the Stripe webhook URL and events from [Plan 1](../1/plan.md).
7. Decide the canonical timezone for class scheduling and document it.

## Phase 3: nginx and HTTPS

Update `nginx/nginx.prod.conf` to:

- listen on 80 and redirect all application traffic to HTTPS;
- listen on 443 with the certificate and private key;
- enable TLS 1.2/1.3 and modern cipher defaults;
- preserve `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and WebSocket headers where needed;
- configure secure cookie forwarding and confirm session cookies work through the proxy;
- add HSTS only after HTTPS is confirmed;
- add a request body size limit and conservative proxy timeouts;
- expose only the public proxy, not Redis, Postgres, RabbitMQ management, or internal services.

Verify that production session cookies have `Secure`, `HttpOnly`, and the intended `SameSite` behavior. Confirm `trust proxy` matches the actual proxy topology.

## Phase 4: Container startup and migrations

Choose one migration strategy and document it:

### Preferred strategy

Run a one-shot migration job for each Prisma database before starting application replicas. Make application services depend on successful migration completion.

### Minimum acceptable strategy

Keep migrations in container startup, but ensure:

- only one instance runs migrations at a time;
- migration failure prevents the service from reporting ready;
- deploy logs clearly identify the migration that failed;
- rollback compatibility is considered before applying destructive schema changes.

Add application Docker healthchecks such as:

- backend `/health/live` and `/health/ready`;
- user-service auth/database readiness endpoint;
- classes-service RabbitMQ/database readiness endpoint;
- registration-service RabbitMQ/database readiness endpoint;
- frontend HTTP readiness.

Use `restart: unless-stopped` only after readiness behavior is correct; otherwise a bad configuration can cause restart loops that hide the root cause.

## Phase 5: Health, logs, and monitoring

Add separate liveness and readiness checks:

- Liveness should confirm the process is running.
- Readiness should confirm required dependencies are reachable.
- Do not expose secrets or raw contact data in health responses.

Add structured JSON logs with:

- service name;
- environment;
- request or correlation ID;
- route and status;
- duration;
- safe error category.

Do not log session IDs, OAuth codes, Stripe secrets/signatures, CAPTCHA tokens, raw IP addresses, contact message bodies, or full payment payloads.

Add error monitoring and alerts for:

- repeated 5xx responses;
- failed OAuth callbacks;
- RabbitMQ disconnects;
- Redis failures;
- database connection failures;
- failed email delivery;
- failed Stripe webhook processing;
- migration failures;
- elevated registration or checkout failure rates.

Add basic metrics for request count/latency, active registrations, waitlist size, payment outcomes, webhook retries, and notification delivery.

## Phase 6: Database durability and recovery

For each Postgres database:

1. Enable automated encrypted backups.
2. Define retention and recovery-point objectives.
3. Test restoring into a separate environment.
4. Document the restore order: Postgres, Redis session/rate-limit behavior, RabbitMQ, then application services.
5. Decide whether Redis sessions and rate-limit counters can be lost during recovery; document the user impact.
6. Back up or export RabbitMQ messages only if the chosen event durability model requires it.

Do not rely on Docker named volumes as the only production backup.

## Phase 7: Deployment and rollback

Add a deployment runbook covering:

- build and image tagging;
- staging deployment;
- Prisma migration review;
- smoke tests;
- production rollout;
- health verification;
- rollback decision points;
- database rollback limitations;
- secret rotation.

Add CI checks for:

- all service builds;
- all service typechecks;
- unit tests;
- backend HTTP E2E tests in an environment that permits listener creation;
- Docker image builds;
- nginx configuration validation;
- dependency vulnerability review.

Prefer immutable image tags and a staging environment that uses Stripe/Turnstile/Resend test credentials.

## Phase 8: Production smoke test

Run this after deployment:

1. `GET /health/live` and `/health/ready` through nginx.
2. Load the class list and one class detail page.
3. Complete Google login and confirm the secure session survives the proxy.
4. Update a profile field.
5. Submit a contact form using test Turnstile and verify persistence/email behavior.
6. Create a free registration and cancel it.
7. Create a Stripe test checkout and confirm the webhook finalizes registration.
8. Confirm an admin can view classes, registrations, payments, and contact submissions.
9. Confirm non-admin users cannot access admin endpoints.
10. Confirm logs, metrics, alerts, and backups are visible.

## Acceptance criteria

- Production starts only with valid, non-placeholder configuration.
- Public traffic is HTTPS-only and secure cookies work correctly.
- Every service has useful liveness/readiness behavior.
- Migrations are repeatable, observable, and deployment-safe.
- Backups and restores have been tested.
- Operators can detect failures and roll back using documented steps.
- A complete authenticated booking/payment/contact smoke test passes through the real proxy.

