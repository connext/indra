#!/bin/bash
set -e

# backup every half hour
backup_frequency=1800
should_restore_backup="no"
backup_file="snapshots/`ls snapshots | sort -r | head -n 1`"

echo "Starting database in env:"
env

# Is this a fresh database? Should we restore data from a snapshot?
if [[ ! -f "/var/lib/postgresql/data/PG_VERSION" && -f "$backup_file" ]]
then 
  echo "Fresh postgres db started w backup present, we'll restore: $backup_file"
  should_restore_backup="yes"
else echo "Database exists or no snapshots found"
fi

# Start temporary database in background to run migrations
while [[ -f "/var/lib/postgresql/data/postmaster.pid" ]]
do echo "Waiting for lock to be released..." && sleep 2
done
/docker-entrypoint.sh postgres &
PID=$!

# Wait for database to wake up
while ! pg_isready; do sleep 2; done
sleep 2
echo "Good morning, Postgres!"

# Run migrations
echo "Running migrations..."
if [[ -z "POSTGRES_PASSWORD" ]]
then POSTGRES_PASSWORD="`cat $POSTGRES_PASSWORD_FILE`"
fi
./node_modules/.bin/db-migrate up --config ops/config.json --verbose all
echo "Migrations complete!"
sleep 2
if [[ -n "POSTGRES_PASSWORD_FILE" ]]
then unset POSTGRES_PASSWORD
fi

# Maybe restore data from snapshot
if [[ "$should_restore_backup" == "yes" ]]
then
  echo "Restoring db snapshot from file $backup_file"
  psql --username=$POSTGRES_USER $POSTGRES_DB < $backup_file
  echo "Done restoring db snapshot"
fi

# Stop the db instance used to run migrations & restore snapshot
echo "Stopping old database.."
kill $PID
while [[ -f "/var/lib/postgresql/data/postmaster.pid" ]]
do echo "Waiting for lock to be released..." && sleep 2
done

# Start migrations signaller
echo "===> Starting migrations signaller"
while true # unix.stackexchange.com/a/37762
do echo 'db migrations complete' | nc -lk -p 5431
done > /dev/null &

# Setup remote backups & start backing up the db periodically
bash ops/configure-remote-backup.sh
echo "===> Starting backer upper"
while true
do sleep 5 && bash ops/backup.sh && sleep $backup_frequency 
done &

# Start database in foreground to serve requests from hub
echo "===> Starting new database.."
exec /docker-entrypoint.sh postgres
