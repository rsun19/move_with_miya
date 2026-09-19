#!/usr/bin/env sh
set -eu

ENV_FILE=${ENV_FILE:-.env.production}

[ -f "$ENV_FILE" ] || { echo "Missing deployment env file: $ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

compose() {
  docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"
}

./ops/preflight-production.sh
compose config --quiet
compose build
compose up -d redis postgres rabbitmq
compose up user-migrate classes-migrate registration-migrate
compose up -d user-service backend classes-service registration-service frontend
compose up -d otel-collector prometheus alertmanager loki tempo grafana

./ops/smoke-test.sh "${PUBLIC_APP_URL:?PUBLIC_APP_URL is required}"
echo "Deployment completed for ${RELEASE_VERSION:-development}."
