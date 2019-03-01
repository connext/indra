#!/bin/bash
set -e

redis=${REDIS_URL#*://}
database=database:5432
db_migrations=database:5431
ethprovider=${ETH_RPC_URL#*://}
eth_migrations=${ethprovider%:*}:8544

echo "Waiting for redis ($redis) to wake up..."
bash ops/wait-for.sh -t 60 $redis 2> /dev/null
echo "Waiting for db migrations ($db_migrations) to finish..."
bash ops/wait-for.sh -t 60 $db_migrations 2> /dev/null
echo "Waiting for database ($database) to wake up..."
bash ops/wait-for.sh -t 60 $database 2> /dev/null
echo "Waiting for eth migrations ($eth_migrations) to finish..."
bash ops/wait-for.sh -t 60 $eth_migrations 2> /dev/null
echo "Waiting for ethprovider ($ethprovider) to wake up..."
bash ops/wait-for.sh -t 60 $ethprovider 2> /dev/null

export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$POSTGRES_URL/$POSTGRES_DB"

export WALLET_ADDRESS="$HUB_WALLET_ADDRESS"
export HOT_WALLET_ADDRESS="$HUB_WALLET_ADDRESS"
export TOKEN_CONTRACT_ADDRESS="$TOKEN_ADDRESS"

if [[ "$2" == "yes" ]]
then
  echo "Starting tsc watcher!"
  ./node_modules/.bin/tsc --watch --preserveWatchOutput --project tsconfig.json &
fi

echo "Starting nodemon $1!"
exec ./node_modules/.bin/nodemon --watch dist --watch /state-hash dist/spankchain/main.js $1
