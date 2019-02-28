#!/bin/bash
set -e

# backup every half hour
backup_frequency=1800
should_restore_backup="no"
backup_file="snapshots/`ls snapshots | sort -r | head -n 1`"

echo "[ENTRY] Starting database in env:"
env

# Is this a fresh database? Should we restore data from a snapshot?
if [[ ! -f "/var/lib/postgresql/data/PG_VERSION" && -f "$backup_file" ]]
then 
  echo "[ENTRY] Fresh postgres db started w backup present, we'll restore: $backup_file"
  should_restore_backup="yes"
else echo "[ENTRY] Database exists or no snapshots found"
fi

# Start temporary database in background to run migrations
while [[ -f "/var/lib/postgresql/data/postmaster.pid" ]]
do echo "[ENTRY] Waiting for lock to be released..." && sleep 2
done
/docker-entrypoint.sh postgres &
PID=$!

# Wait for database to wake up
while ! pg_isready; do echo '[ENTRY] Waiting...' && sleep 2; done
sleep 2 # wake up for real
while ! pg_isready; do echo '[ENTRY] Waiting...' && sleep 2; done
sleep 2
echo "[ENTRY] Good morning, Postgres!"

# Maybe restore data from snapshot
if [[ "$should_restore_backup" == "yes" ]]
then
  echo "[ENTRY] Restoring db snapshot from file $backup_file"
  sleep 2
  psql --username=$POSTGRES_USER $POSTGRES_DB < $backup_file
  echo "[ENTRY] Done restoring db snapshot"
fi

# Run migrations
echo "[ENTRY] Running migrations..."
if [[ -n "POSTGRES_PASSWORD_FILE" ]]
then export POSTGRES_PASSWORD="`cat $POSTGRES_PASSWORD_FILE`"
fi
./node_modules/.bin/db-migrate up --config ops/config.json --verbose all
echo "[ENTRY] Migrations complete!"
if [[ -n "POSTGRES_PASSWORD_FILE" ]]
then unset POSTGRES_PASSWORD
fi

# Stop the db instance used to run migrations & restore snapshot
echo "[ENTRY] Stopping old database.."
kill $PID
while [[ -f "/var/lib/postgresql/data/postmaster.pid" ]]
do echo "[ENTRY] Waiting for lock to be released..." && sleep 2
done

# Start migrations signaller
echo "[ENTRY] ===> Starting migrations signaller"
while true # unix.stackexchange.com/a/37762
do echo 'db migrations complete' | nc -lk -p 5431
done > /dev/null &

# Setup remote backups & start backing up the db periodically
bash ops/configure-remote-backup.sh
echo "[ENTRY] ===> Starting backer upper"
while true
do sleep $backup_frequency && bash ops/backup.sh
done &

# Set an exit trap so that the database will do one final backup before shutting down
function finish {
  echo "[ENTRY] Database exiting, doing one final backup"
  bash ops/backup.sh
  echo "[ENTRY] Done, database exiting.."
}
trap finish EXIT

# Start database in foreground to serve requests from hub
echo "[ENTRY] ===> Starting new database.."
exec /docker-entrypoint.sh postgres
