#!/bin/bash
set -e

MIGRATIONS=database:5433
DATABASE=database:5432
REDIS=${REDIS_URL#*://}

echo "Waiting for $MIGRATIONS and $DATABASE and $REDIS to wake up..."
bash ops/wait-for-it.sh -t 60 $MIGRATIONS 2> /dev/null
bash ops/wait-for-it.sh -t 60 $DATABASE 2> /dev/null
bash ops/wait-for-it.sh -t 60 $REDIS 2> /dev/null

export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$DATABASE/$POSTGRES_DB"

echo "Starting $1!"
exec node ./dist/spankchain/main.js $1
