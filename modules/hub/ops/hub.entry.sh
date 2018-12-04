#!/bin/bash
set -e

DATABASE=database:5432
export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$DATABASE/$POSTGRES_DB"

bash ops/wait-for-it.sh $DATABASE 2> /dev/null

node ./dist/spankchain/main.js hub
