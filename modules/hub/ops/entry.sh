#!/bin/bash
set -e

migrations=database:5433
database=database:5432
redis=${REDIS_URL#*://}

echo "Waiting for $migrations and $database and $redis to wake up..."
bash ops/wait-for-it.sh -t 60 $migrations 2> /dev/null
bash ops/wait-for-it.sh -t 60 $database 2> /dev/null
bash ops/wait-for-it.sh -t 60 $redis 2> /dev/null

export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$database/$POSTGRES_DB"

# Dev mode: the whole modules/hub dir will be bind-mounted in
if [[ -d "src" && -f "tsconfig.json" ]]
then
  echo "Starting tsc watcher!"
  ./node_modules/.bin/tsc --watch --preserveWatchOutput --project tsconfig.json &
  echo "Starting nodemon $1!"
  exec ./node_modules/.bin/nodemon --watch dist dist/entry.js $1

# Prod mode: only a couple dirs are copied in at build-time
else
  echo "Starting node $1!"
  exec node dist/entry.js $1
fi

