#!/bin/bash
set -e

REDIS=${REDIS_URL#*://}
DATABASE=database:5432
export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$DATABASE/$POSTGRES_DB"

echo "Waiting for $DATABASE and $REDIS to wake up..."
bash ops/wait-for-it.sh $DATABASE 2> /dev/null
bash ops/wait-for-it.sh $REDIS 2> /dev/null

node ./dist/spankchain/main.js chainsaw &
node ./dist/spankchain/main.js
