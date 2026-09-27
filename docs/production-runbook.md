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
| `HighHttpErrorRate` | More than 5% of requests return 5xx for 5 minutes | Check logs in Grafana/Loki by `requestId` |
| `HighHttpLatency` | p95 latency is above 1 second for 10 minutes | Check dependency health and traces in Tempo |
| `RefundsNeedAttention` | A refund exhausted its 10 automatic retries | Admin → Payments: read the error, then retry or resolve it in Stripe |
| `StripeWebhookProcessingFailed` | A Stripe webhook event failed processing for 15 minutes | Fix the cause from the backend logs; Stripe retries for 3 days, after that resend the event from the Stripe dashboard |

Send a test alert after every change to the alerting setup:

```bash
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec alertmanager \
  amtool alert add TestAlert severity=warning \
  --annotation='summary="Test alert"' --alertmanager.url=http://localhost:9093
```

Rule changes are unit-tested in [ops/observability/alerts.test.yml](../ops/observability/alerts.test.yml) (`promtool test rules`), which CI runs.
