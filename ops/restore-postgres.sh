#!/usr/bin/env sh
set -eu
umask 077

[ "${CONFIRM_RESTORE:-}" = YES ] || { echo 'Set CONFIRM_RESTORE=YES to restore into an isolated target.' >&2; exit 1; }
[ "${ALLOW_DESTRUCTIVE_RESTORE:-}" = YES ] || { echo 'Set ALLOW_DESTRUCTIVE_RESTORE=YES to acknowledge that restore replaces data.' >&2; exit 1; }
ENV_FILE=${ENV_FILE:-.env.production}
BACKUP_DIR=${BACKUP_DIR:?BACKUP_DIR is required}
AGE_IDENTITY=${AGE_IDENTITY:?AGE_IDENTITY is required}
timestamp=${BACKUP_TIMESTAMP:?BACKUP_TIMESTAMP is required}
case "$timestamp" in
  *[!A-Za-z0-9_.-]*) echo 'BACKUP_TIMESTAMP contains invalid path characters' >&2; exit 1 ;;
esac

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

for database in miya_users miya_classes miya_registrations; do
  encrypted="$BACKUP_DIR/${database}_${timestamp}.dump.age"
  dump="$tmp_dir/${database}.dump"
  age --decrypt --identity "$AGE_IDENTITY" --output "$dump" "$encrypted"
  docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec -T postgres \
    sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_restore --clean --if-exists --no-owner --no-privileges -U \"\$POSTGRES_USER\" -d '$database'" \
    < "$dump"
done

echo 'PostgreSQL restore completed. Re-run migrations and smoke tests before serving traffic.'
