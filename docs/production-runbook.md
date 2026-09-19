# Production Runbook

## Deployment prerequisites

1. Point the production domain and `www` behavior to the host.
2. Provision a trusted certificate and key, and set `TLS_CERT_FILE` and `TLS_KEY_FILE` in the deployment-host environment file.
3. Register the exact HTTPS Google OAuth callback URL.
4. Restrict Turnstile to the production hostname.
5. Verify the Resend sending domain and configure SPF, DKIM, and DMARC.
6. Register the Stripe webhook at `/api/checkout/webhook`.
7. Set `RELEASE_VERSION` to the immutable Git SHA.
8. Set a strong `GRAFANA_ADMIN_PASSWORD`; do not expose Grafana's container port publicly.

The populated environment file must live outside the repository with restrictive file permissions. Run `./ops/preflight-production.sh` before deployment.

## Deploy

```bash
ENV_FILE=/path/to/.env.production ./ops/deploy.sh
```

The deployment builds images, starts infrastructure, runs each Prisma migration as a one-shot job, starts application services, starts observability services, and performs public health checks. A migration failure must stop the rollout.

The manual GitHub Actions workflow requires environment-scoped `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_ENV_FILE`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS` secrets. It supports both deploy and application rollback operations.

## Observability

Prometheus, Grafana, Loki, Tempo, the OpenTelemetry Collector, and Alertmanager run on the same Compose host. Their ports are internal-only. The application admin area exposes a controlled health summary at `/admin/observability`; Grafana is used for detailed investigation.

Same-host monitoring means observability is unavailable during a host outage. Metrics, logs, and traces are diagnostic data and are not part of the business-data backup set.

## Rollback

```bash
ROLLBACK_VERSION=<previous-sha> ENV_FILE=/path/to/.env.production ./ops/rollback.sh
```

Application images may be rolled back. Database migrations are not automatically reversed. For an incompatible schema change, restore PostgreSQL into an isolated target, verify the restore, and only then perform a controlled database recovery.

## Backup and restore

Create encrypted backups with an off-host copy:

```bash
AGE_RECIPIENT=<age-recipient> \
ENV_FILE=/path/to/.env.production \
BACKUP_DIR=/secure/backup/path \
./ops/backup-postgres.sh
```

Restore only into an isolated target:

```bash
CONFIRM_RESTORE=YES \
ALLOW_DESTRUCTIVE_RESTORE=YES \
AGE_IDENTITY=/secure/age-key.txt \
BACKUP_TIMESTAMP=<timestamp> \
BACKUP_DIR=/secure/backup/path \
ENV_FILE=/path/to/.env.production \
./ops/restore-postgres.sh
```

The recovery order is PostgreSQL, application migrations, application services, then Redis/RabbitMQ-dependent behavior. Redis sessions and rate-limit counters may be lost; users can sign in again.

## Authenticated smoke checklist

- Complete Google login through the HTTPS proxy and confirm the session cookie is secure.
- Load a class and class detail page.
- Update a profile field.
- Submit a test contact form and verify persistence/email behavior.
- Create and cancel a free registration.
- Complete Stripe test checkout and confirm webhook fulfillment.
- Confirm an admin can view the observability tab.
- Confirm a non-admin receives `403` for the observability endpoint.
- Confirm Grafana dashboards, alerts, backups, and deployment logs are available.
