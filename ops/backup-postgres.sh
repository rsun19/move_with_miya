#!/usr/bin/env sh
set -eu
umask 077

ENV_FILE=${ENV_FILE:-.env.production}
BACKUP_DIR=${BACKUP_DIR:-./backups}
AGE_RECIPIENT=${AGE_RECIPIENT:?AGE_RECIPIENT is required for encrypted backups}
mkdir -p "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

for database in miya_users miya_classes miya_registrations; do
  output="$tmp_dir/${database}_${timestamp}.dump"
  docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec -T postgres \
    sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_dump --format=custom --no-owner --no-privileges -U \"\$POSTGRES_USER\" -d '$database'" \
    > "$output"
  age --encrypt --recipient "$AGE_RECIPIENT" --output "$BACKUP_DIR/$(basename "$output").age" "$output"
done

sha256sum "$BACKUP_DIR"/*_${timestamp}.dump.age > "$BACKUP_DIR/SHA256SUMS_${timestamp}.txt"
echo "Encrypted PostgreSQL backups written to $BACKUP_DIR."
