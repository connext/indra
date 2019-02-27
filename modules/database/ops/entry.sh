#!/bin/bash
set -e

# backup every half hour
backup_frequency=1800

echo "===> Starting database in env:"
env

# Start temporary database in background to run migrations
while [[ -f "/var/lib/postgresql/data/postmaster.pid" ]]
do echo "===> Waiting for lock to be released..." && sleep 2
done
/docker-entrypoint.sh postgres &
PID=$!
ops/wait-for-it.sh 127.0.0.1:5432
echo "===> Good morning, Postgres!"

# Run migrations
echo "===> Running migrations..."
migrate=./node_modules/.bin/db-migrate
if [[ -z "POSTGRES_PASSWORD" ]]
then POSTGRES_PASSWORD="`cat $POSTGRES_PASSWORD_FILE`"
fi
$migrate up --config ops/config.json --verbose all
if [[ -n "POSTGRES_PASSWORD_FILE" ]]
then unset POSTGRES_PASSWORD
fi

# Turn this off until we can confirm it's supposed to work
if [[ -n "$TEST" ]]
then
  echo "===> Testing migration results..."
  outf="/tmp/migration-test-results"
  for f in test/*.sql
  do
    echo "Testing: $f"
    psql --username=$POSTGRES_USER $POSTGRES_DB < "$f" > "$outf"
    diff -u "$f.expected" "$outf" || {
      echo "Oh no.. hint: run cp $outf \"$PWD/$f.expected\""
      exit 1
    }
    echo "Okay!"
  done
fi

# Stop the db instance used to run migrations
echo "===> Stopping old database.."
kill $PID
while [[ -f "/var/lib/postgresql/data/postmaster.pid" ]]
do echo "===> Waiting for lock to be released..." && sleep 2
done

echo "===> Signalling the completion of migrations..."
while true # unix.stackexchange.com/a/37762
do echo 'db migrations complete' | nc -lk -p 5431
done > /dev/null &

# Setup remote backups & start backing up the db periodically
bash ops/configure-remote-backup.sh
echo "===> Backup watcher started..."
while true
do sleep $backup_frequency && bash ops/backup-db.sh
done &

# Start database in foreground to serve requests from hub
echo "===> Starting new database.."
exec /docker-entrypoint.sh postgres
