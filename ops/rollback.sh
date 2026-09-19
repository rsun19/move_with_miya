#!/usr/bin/env sh
set -eu

ENV_FILE=${ENV_FILE:-.env.production}
[ -f "$ENV_FILE" ] || { echo "Missing deployment env file: $ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo 'Application rollback only: database migrations are not automatically reversed.'
echo 'Restore the database from a verified backup before attempting a destructive schema rollback.'

if [ -n "${ROLLBACK_VERSION:-}" ]; then
  case "$ROLLBACK_VERSION" in
    *[!A-Fa-f0-9]*|'')
      echo 'ROLLBACK_VERSION must be a 40-character Git SHA' >&2
      exit 1
      ;;
  esac
  [ "${#ROLLBACK_VERSION}" -eq 40 ] || {
    echo 'ROLLBACK_VERSION must be a 40-character Git SHA' >&2
    exit 1
  }
  sed -i "s/^RELEASE_VERSION=.*/RELEASE_VERSION=$ROLLBACK_VERSION/" "$ENV_FILE"
fi

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml up -d --no-build user-service backend classes-service registration-service frontend
./ops/smoke-test.sh "${PUBLIC_APP_URL:?PUBLIC_APP_URL is required}"
