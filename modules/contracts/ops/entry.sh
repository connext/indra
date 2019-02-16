#!/bin/bash
set -e

########################################
# Set env vars

ganache_net_id=4447
ganache_rpc_port=8545
migration_flag_port=8544

if [[ -n "$ETH_NETWORK" ]]
then network=$ETH_NETWORK
else network="ganache"
fi

if [[ -n "$ETH_MNEMONIC" ]]
then mnemonic=$ETH_MNEMONIC
else mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
fi

export API_KEY=$API_KEY
export ETH_MNEMONIC=$ETH_MNEMONIC
export ETH_NETWORK=$ETH_NETWORK
export ETH_PROVIDER=$ETH_PROVIDER
export PRIVATE_KEY_FILE=$PRIVATE_KEY_FILE

echo "The eth provider has awoken in env:"
env
echo

########################################
# Setup some helper functions

function checkNetwork {
  if [[ "$1" == "mainnet" && "$2" == "1" ]]
  then true
  elif [[ "$1" == "ropsten" && "$2" == "3" ]]
  then true
  elif [[ "$1" == "rinkeby" && "$2" == "4" ]]
  then true
  elif [[ "$1" == "kovan" && "$2" == "42" ]]
  then true
  elif [[ "$1" == "ganache" && "$2" == "4447" ]]
  then true
  else
    echo "Network $network doesn't match chain id ($netid) of provider: $ETH_PROVIDER"
    exit 1
  fi
}

function curleth {
  curl --silent \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{"id":31415,"jsonrpc":"2.0","method":"'"$1"'","params":'"$2"'}' \
    $ETH_PROVIDER \
      | jq .result \
      | tr -d '"\n\r'
}

function getAddress {
  cat ops/addresses.json | jq ".$1.networks[\"$2\"].address"
}

function getHash {
  find build/contracts contracts migrations ops/addresses.json -type f -not -name "*.swp" \
    | xargs cat | sha256sum | tr -d ' -'
}

function migrate {
  echo "Checking network conditions before migrating.."
  # Do we have access to relevant contract addresses?
  # If not, migrate
  # If so, do these addresses have the expected bytecode?
  # If not, migrate
  if [[ "`getHash`" != "`cat build/state-hash 2> /dev/null || true`" ]]
  then
    echo && echo "Migration activated! New state: `getHash`" 
    ./node_modules/.bin/truffle compile
    ./node_modules/.bin/truffle migrate --reset --network=$network
    getHash > build/state-hash
  fi
}

function signal_migrations_complete {
  echo "===> Signalling the completion of migrations..."
  while true # unix.stackexchange.com/a/37762
  do sleep 2 && echo 'eth migrations complete' | nc -lk -p $migration_flag_port
  done > /dev/null
}

function watch {
  echo "Watching contract src & artifacts for changes.."
  while true
  do migrate && sleep 2
  done
}

########################################
# Start local testnet if in dev mode

if [[ "$network" == "ganache" ]]
then
  echo "Starting Ganache.."
  mkdir -p /data build/contracts
  ./node_modules/.bin/ganache-cli \
    --host="0.0.0.0" \
    --port="$ganache_rpc_port" \
    --db="/data" \
    --mnemonic="$mnemonic" \
    --networkId="$ganache_net_id" \
    --blockTime=3 > ops/ganache.log &
  # Wait for ganache to start responding
  while [[ -z "`curleth net_version '[]'`" ]]
  do sleep 1
  done
fi

########################################
# Make some sanity checks

if [[ -z "$ETH_PROVIDER" ]]
then echo "ETH_PROVIDER env var not available, aborting" && exit
else echo "Preparing migrations for $network against provider: $ETH_PROVIDER"
fi

netid="`curleth net_version '[]'`"

checkNetwork $network $netid

########################################
# Decide whether or not to migrate

ECToolsAddress="`getAddress ECTools $netid`"
ChannelManagerAddress="`getAddress ChannelManager $netid`"

echo "ECToolsAddress=$ECToolsAddress"
echo "ChannelManagerAddress=$ChannelManagerAddress"

########################################
# Migrate (& maybe start watcher)

echo "Migrations activated!"

exit

migrate

if [[ "$1" == "yes" ]]
then
  signal_migrations_complete &
  watch
else
  signal_migrations_complete
fi

echo "Deploying in prod or staging mode"

# TODO sanity check: does our given net id match what our provider gives us?
./node_modules/.bin/truffle migrate --reset --network=$network

