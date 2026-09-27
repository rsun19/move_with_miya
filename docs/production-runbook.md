# Production Runbook

## Deployment prerequisites

1. Point the production domain and `www` behavior to the host.
2. Provision a trusted certificate and key, and set `TLS_CERT_FILE` and `TLS_KEY_FILE` in the deployment-host environment file.
3. Register the exact HTTPS Google OAuth callback URL.
4. Restrict Turnstile to the production hostname.
5. Verify the Resend sending domain and configure SPF, DKIM, and DMARC.
6. Register the Stripe webhook at `/api/checkout/webhook`.
7. Set a strong `GRAFANA_ADMIN_PASSWORD`; do not expose Grafana's container port publicly.

The populated environment file must live outside the repository with restrictive file permissions (`chmod 600`).

## Application stack

`docker-compose.prod.yml` builds images tagged `move-with-miya/<service>:${RELEASE_VERSION}`. Each service's Prisma migrations run as a one-shot `*-migrate` job, and the service only starts after its job completes successfully. Every service exposes `/health/live` and `/health/ready`; Compose healthchecks use the readiness endpoint, and nginx only starts once the services behind it are healthy.

nginx terminates TLS, redirects HTTP to HTTPS, and blocks the internal `/metrics` endpoints. It resolves upstream addresses at startup, so reload it (`nginx -s reload`) after recreating application containers.

CI enforces these rules: `ops/check-compose.py` checks the Compose invariants (only nginx publishes ports, images are tagged by release, services restart and wait for their migrations), and `nginx/test-routing.sh` runs the real nginx config and checks redirects, blocked endpoints, proxied routes, HSTS, and the body-size limit. Both run locally with Docker.

## Observability

Prometheus, Grafana, Loki (with Promtail), Tempo, and the OpenTelemetry Collector run on the same Compose host. Their ports are internal-only; reach Grafana through an SSH tunnel or a separately protected proxy (`GRAFANA_PUBLIC_URL` adds a link to it in the admin area). The admin area exposes a controlled health summary at `/admin/observability`.

- Metrics: Prometheus scrapes each service's `/metrics` every 15 seconds and keeps `PROMETHEUS_RETENTION` (default 14 days).
- Logs: Promtail ships container logs to Loki, which keeps 14 days.
- Traces: services export OTLP traces to the collector, which forwards them to Tempo.

Same-host monitoring means observability is unavailable during a host outage. Metrics, logs, and traces are diagnostic data and are not part of the business-data backup set.

## Alerting

Prometheus evaluates [ops/observability/alerts.yml](../ops/observability/alerts.yml) and sends firing alerts to Alertmanager, which emails `ALERT_EMAIL_TO` through Resend's SMTP relay (`smtp.resend.com`, authenticated with `RESEND_API_KEY`, sent from `RESEND_FROM_EMAIL`). The API key reaches Alertmanager as a Compose secret, which needs Docker Compose 2.23 or newer.

| Alert | Fires when | Response |
|---|---|---|
| `ServiceDown` | A service's metrics endpoint is unreachable for 2 minutes | Check `docker compose ps` and the service logs |
| `HighHttpErrorRate` | More than 5% of requests return 5xx for 5 minutes (with at least 5 requests in the window) | Check logs in Grafana/Loki by `requestId` |
| `HighHttpLatency` | p95 latency is above 1 second for 10 minutes | Check dependency health and traces in Tempo |
| `RefundsNeedAttention` | A refund exhausted its 10 automatic retries | Admin → Payments: read the error, then retry or resolve it in Stripe |
| `StripeWebhookProcessingFailed` | A Stripe webhook event failed processing for 15 minutes | Fix the cause from the backend logs; Stripe retries for 3 days, after that resend the event from the Stripe dashboard |

Send a test alert after every change to the alerting setup:

```bash
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec alertmanager \
  amtool alert add TestAlert severity=warning \
  --annotation='summary="Test alert"' --alertmanager.url=http://localhost:9093
```

Every rule is unit-tested in [ops/observability/alerts.test.yml](../ops/observability/alerts.test.yml) (`promtool test rules`), and [ops/observability/test-alertmanager.sh](../ops/observability/test-alertmanager.sh) starts the real Alertmanager service to check its rendered recipients and secret; CI runs both.

## Backups

Every night at 03:30 UTC, [ops/backup-postgres.sh](../ops/backup-postgres.sh):

1. dumps each database (`miya_users`, `miya_classes`, `miya_registrations`) with `pg_dump`,
2. encrypts each dump with [age](https://age-encryption.org) for `AGE_RECIPIENT`, so the server can create backups but cannot read them,
3. copies the encrypted files and a `SHA256SUMS` file to `BACKUP_REMOTE` with rclone, never overwriting existing files, and
4. prunes local copies older than `BACKUP_LOCAL_RETENTION_DAYS` (default 7).

If a run fails, a `BackupFailed` alert is emailed and stays active until the next successful run clears it. Redis (sessions, rate limits) and RabbitMQ (queues) are not backed up; they rebuild themselves. netcup server snapshots are a useful extra layer but not a substitute: they stay with the same provider and are not consistent database dumps.

### One-time setup

1. **Encryption key, on your own machine (not the server).** Run `age-keygen -o miya-backup-key.txt`. Store the file in your password manager plus one offline copy; without it no backup can be read. Put the printed public key (`age1…`) in `AGE_RECIPIENT`.
2. **Off-host storage: Backblaze B2, EU Central region.**
   - Create a private bucket.
   - Add a lifecycle rule that hides files 30 days after upload and deletes them 1 day after hiding. B2 then enforces retention, not the server.
   - Create an upload key for the server that cannot delete, for example with the B2 CLI: `b2 key create --bucket <bucket> miya-backup-upload listBuckets,listFiles,writeFiles`. A compromised server then cannot erase the backups.
   - Create a separate read key (`listBuckets,listFiles,readFiles`) for restores and keep it off the server.
3. **Server.** Install the tools with `sudo apt install age rclone`, then fill in the backup and `RCLONE_CONFIG_B2_*` values in the env file. rclone reads its remote from those variables, so no rclone config file is needed. Test with `sudo ENV_FILE=/etc/move-with-miya/env.production ./ops/backup-postgres.sh`.
4. **Schedule.** Copy `ops/systemd/move-with-miya-backup.{service,timer}` to `/etc/systemd/system/`, adjust the checkout and env-file paths in the service, then run `sudo systemctl daemon-reload && sudo systemctl enable --now move-with-miya-backup.timer`. `systemctl list-timers move-with-miya-backup.timer` shows the next run.

### Restore drill (monthly, on your own machine)

Prove that a backup can actually be decrypted and restored:

```bash
rclone copy b2:<bucket>/postgres ./drill --include '*_<timestamp>*'   # read key
cd drill && sha256sum -c SHA256SUMS_<timestamp>.txt
docker run -d --name miya-restore-drill -e POSTGRES_PASSWORD=drill postgres:16-alpine
age -d -i miya-backup-key.txt miya_registrations_<timestamp>.dump.age \
  | docker exec -i miya-restore-drill pg_restore -U postgres --no-owner --create -d postgres
docker exec miya-restore-drill psql -U postgres -d miya_registrations -c 'SELECT count(*) FROM "Payment";'
docker rm -f miya-restore-drill
```

### Recovering production

Stop the application services, restore, then start them again so migrations and healthchecks run:

```bash
compose() { docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"; }
compose stop user-service backend classes-service registration-service
RCLONE_CONFIG_B2READ_TYPE=b2 RCLONE_CONFIG_B2READ_ACCOUNT=<read-key-id> \
RCLONE_CONFIG_B2READ_KEY=<read-key> RESTORE_REMOTE=b2read:<bucket>/postgres \
CONFIRM_RESTORE=YES ALLOW_DESTRUCTIVE_RESTORE=YES \
AGE_IDENTITY=/secure/miya-backup-key.txt BACKUP_TIMESTAMP=<timestamp> \
ENV_FILE=/etc/move-with-miya/env.production ./ops/restore-postgres.sh
compose up -d user-service backend classes-service registration-service
```

Files that are not in `BACKUP_DIR` are fetched from `RESTORE_REMOTE`, a remote using the read key (the server's own key can only upload). Checksums are verified before anything is restored. Remove the read key and the private age key from the server afterwards.
