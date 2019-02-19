#!/bin/bash
set -e

database=$POSTGRES_HOST:$POSTGRES_PORT
db_migrations=${database%:*}:5433
ethprovider=${ETH_RPC_URL#*://}
eth_migrations=${ethprovider%:*}:8544
redis=${REDIS_URL#*://}

echo "Waiting for $db_migrations & $database & $eth_migrations & $ethprovider & $redis to wake up..."
bash ops/wait-for.sh -t 60 $db_migrations 2> /dev/null
bash ops/wait-for.sh -t 60 $database 2> /dev/null
bash ops/wait-for.sh -t 60 $eth_migrations 2> /dev/null
bash ops/wait-for.sh -t 60 $ethprovider 2> /dev/null
bash ops/wait-for.sh -t 60 $redis 2> /dev/null

export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$database/$POSTGRES_DB"

export WALLET_ADDRESS="$HUB_WALLET_ADDRESS"
export HOT_WALLET_ADDRESS="$HUB_WALLET_ADDRESS"
export PRIVATE_KEY_FILE="/run/secrets/private_key_dev"
export ETH_NETWORK_ID="$ETH_NETWORK_ID"
export CHANNEL_MANAGER_ADDRESS="$CHANNEL_MANAGER_ADDRESS"
export TOKEN_CONTRACT_ADDRESS="$TOKEN_ADDRESS"

function watch_src {
  echo "Starting tsc watcher!"
  ./node_modules/.bin/tsc --watch --preserveWatchOutput --project tsconfig.json
}

if [[ "$2" == "yes" ]]
then watch_src &
fi

echo "Starting nodemon $1!"
exec ./node_modules/.bin/nodemon --watch dist --watch /state-hash dist/spankchain/main.js $1
