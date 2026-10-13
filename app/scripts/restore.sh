#!/bin/sh
set -eu
# Restore into an EMPTY target database. No --clean or destructive overwrite.
[ "$#" = 1 ] || { echo 'Usage: sh scripts/restore.sh /absolute/path/classpaper.dump' >&2; exit 1; }
docker compose exec -T db pg_restore -U classpaper -d classpaper --exit-on-error < "$1"
echo 'Restore complete. Verify sign-in, publications, results and retained sources.'
