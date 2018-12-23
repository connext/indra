#!/bin/bash
set -e

echo "arg 1 = $1"
echo "arg 2 = $2"

database=$POSTGRES_HOST:$POSTGRES_PORT
db_migrations=${database%:*}:5433
ethprovider=${ETH_RPC_URL#*://}
eth_migrations=${ethprovider%:*}:8544
redis=${REDIS_URL#*://}

echo "Waiting for $db_migrations & $database & $eth_migrations & $ethprovider & $redis to wake up..."
bash ops/wait-for-it.sh -t 60 $db_migrations 2> /dev/null
bash ops/wait-for-it.sh -t 60 $database 2> /dev/null
bash ops/wait-for-it.sh -t 60 $eth_migrations 2> /dev/null
bash ops/wait-for-it.sh -t 60 $ethprovider 2> /dev/null
bash ops/wait-for-it.sh -t 60 $redis 2> /dev/null

export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$database/$POSTGRES_DB"

function getHash {
  find /contracts -type f -not -name "*.swp" | xargs cat | sha256sum | tr -d ' -'
}

function ethersGet {
  cmd="console.log(require('ethers').Wallet.fromMnemonic(process.env.ETH_MNEMONIC).$1)"
  echo $cmd | node | tr -d '\n\r'
}

function curleth {
  opts="-s -H \"Content-Type: application/json\" -X POST --data "
  curl $opts '{"id":31415,"jsonrpc":"2.0","method":"'"$1"'","params":'"$2"'}' $ethprovider \
    | jq .result \
    | tr -d '"\n\r'
}

function extractAddress {
  cat /contracts/$1.json | jq '.networks["'"$ETH_NETWORK_ID"'"].address' | tr -d '"\n\r'
}

function eth_env_setup {
  export ETH_STATE_HASH="`getHash`"
  echo -n `getHash` /state-hash
  echo "Setting up eth env for state hash: $ETH_STATE_HASH.."
  export WALLET_ADDRESS="`ethersGet address`"
  export HOT_WALLET_ADDRESS="`ethersGet address`"
  ethersGet privateKey > /private_key_dev
  export PRIVATE_KEY_FILE="/private_key_dev"
  export ETH_NETWORK_ID="`curleth 'net_version' '[]'`"
  export CHANNEL_MANAGER_ADDRESS="`extractAddress ChannelManager`"
  export TOKEN_CONTRACT_ADDRESS="`extractAddress HumanStandardToken`"
}
eth_env_setup

function watch_eth_state {
  echo "Starting eth state watcher!"
  while true
  do
    if [[ "`getHash`" == "$ETH_STATE_HASH" ]]
    then sleep 3
    else echo "Changes detected! Refreshing eth env" && eth_env_setup
    fi
  done
}

function watch_src {
  echo "Starting tsc watcher!"
  ./node_modules/.bin/tsc --watch --preserveWatchOutput --project tsconfig.json
}

if [[ "$2" == "watch" ]]
then
  watch_eth_state &
  watch_src &
fi

echo "Starting nodemon $1!"
exec ./node_modules/.bin/nodemon --watch dist --watch /state-hash dist/entry.js $1
