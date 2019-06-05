#!/bin/bash
set -e

migrations=database:5431
database=database:5432
ethprovider=${ETH_RPC_URL#*://}
redis=${REDIS_URL#*://}

echo "Waiting for redis ($redis) to wake up..."
bash ops/wait-for.sh -t 60 $redis 2> /dev/null
echo "Waiting for db migrations ($migrations) to finish..."
bash ops/wait-for.sh -t 60 $migrations 2> /dev/null
echo "Waiting for database ($database) to wake up..."
bash ops/wait-for.sh -t 60 $database 2> /dev/null
echo "Waiting for ethprovider ($ethprovider) to wake up..."
bash ops/wait-for.sh -t 60 $ethprovider 2> /dev/null

export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$database/$POSTGRES_DB"

echo "Starting node $1!"
exec node dist/spankchain/main.js $1
