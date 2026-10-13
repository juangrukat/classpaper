#!/bin/sh
set -eu
# Run from app/. Leave backups outside the repository or under ignored data/.
[ "$#" = 1 ] || { echo 'Usage: sh scripts/backup.sh /absolute/path/classpaper.dump' >&2; exit 1; }
umask 077
docker compose exec -T db pg_dump -U classpaper -d classpaper -Fc > "$1"
echo 'Backup complete. Rehearse restore before relying on it.'
