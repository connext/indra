#!/bin/bash
set -e

# Print env then add database password
echo "=> Starting Postgres in env:"
env

# Start temporary database in background to run migrations
/docker-entrypoint.sh postgres &
PID=$!
ops/wait-for-it.sh 127.0.0.1:5432
echo "=> Good morning, Postgres! Running migrations..."

# Run migrations
migrate=./node_modules/.bin/db-migrate
POSTGRES_PASSWORD="`cat $POSTGRES_PASSWORD_FILE`"
$migrate up all --verbose --config ops/config.json --migrations-dir node_modules/machinomy/migrations
$migrate up all --verbose --config ops/config.json --migrations-dir migrations
unset POSTGRES_PASSWORD

# Start database in foreground to serve requests from hub
echo "=> Migrations completed successfully, restarting database"
kill $PID
exec /docker-entrypoint.sh postgres
