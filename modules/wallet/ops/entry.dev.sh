#!/bin/bash

echo "Wallet entrypoint activated!"

# These are docker swarm hostnames, not available from browser
hub="hub:8080"
eth_migrations="ethprovider:8544"
eth_provider="ethprovider:8545"

echo "Waiting for $hub & $eth_migrations & $eth_provider to wake up.."
bash /ops/wait-for.sh -t 60 $hub 2> /dev/null
bash /ops/wait-for.sh -t 60 $eth_migrations 2> /dev/null
bash /ops/wait-for.sh -t 60 $eth_provider 2> /dev/null

function getHash {
  find /contracts -type f -not -name "*.swp" | xargs cat | sha256sum | tr -d ' -'
}

function ethersGet {
  cmd="console.log(require('ethers').Wallet.fromMnemonic(process.env.ETH_MNEMONIC).$1)"
  echo $cmd | node | tr -d '\n\r'
}

function curleth {
  opts="-s -H \"Content-Type: application/json\" -X POST --data "
  curl $opts '{"id":31415,"jsonrpc":"2.0","method":"'"$1"'","params":'"$2"'}' $eth_provider \
    | jq .result \
    | tr -d '"\n\r'
}

function extractAddress {
  cat /contracts/$1.json | jq '.networks["'"$ETH_NETWORK_ID"'"].address' | tr -d '"\n\r'
}

function eth_env_setup {
  export ETH_STATE_HASH="`getHash`"
  echo -n `getHash` > /state-hash
  echo "Resetting eth env for state hash: $ETH_STATE_HASH.."
  export ETH_NETWORK_ID="`curleth 'net_version' '[]'`"
  echo "REACT_APP_DEV=false" > .env
  echo "REACT_APP_HUB_URL=$HUB_URL" >> .env
  echo "REACT_APP_ETHPROVIDER_URL=$ETHPROVIDER_URL" >> .env
  echo "REACT_APP_HUB_WALLET_ADDRESS=`ethersGet address`" >> .env
  echo "REACT_APP_CHANNEL_MANAGER_ADDRESS=`extractAddress ChannelManager`" >> .env
  echo "REACT_APP_TOKEN_ADDRESS=`extractAddress HumanStandardToken`" >> .env
  echo "Done! new eth env:"
  cat .env
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

function watch_client_src {
# Start typescript watcher in background
  echo "Starting connext-client src watcher..."
  ./node_modules/.bin/tsc --watch --preserveWatchOutput --project tsconfig.json &
  cd /client
  npm run watch
}

if [[ "$1" == "yes" ]]
then
  watch_eth_state &
  watch_client_src &
else echo "not watching eth state, turn this on in deploy.dev.sh if desired"
fi

# Start wallet react app
echo "Starting wallet dev server..."
cd /root && echo "cwd=`pwd`"
exec npm start
