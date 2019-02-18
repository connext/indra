#!/bin/bash
set -e

########################################
# env setup

ganache_net_id=4447
ganache_rpc_port=8545
migration_flag_port=8544

########################################
# Setup some helper functions

function curleth {
  curl --silent \
    --header "Content-Type: application/json" \
    --request POST \
    --data '{"id":31415,"jsonrpc":"2.0","method":"'"$1"'","params":'"$2"'}' \
    $ETH_PROVIDER \
      | jq .result \
      | tr -d '"\n\r'
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
  do node ops/migrate.js && sleep 5
  done
}

########################################
# Start local testnet if in dev mode

if [[ "$ETH_NETWORK" == "ganache" ]]
then
  echo "Starting Ganache.."
  mkdir -p /data build/contracts
  ./node_modules/.bin/ganache-cli \
    --host="0.0.0.0" \
    --port="$ganache_rpc_port" \
    --db="/data" \
    --mnemonic="$ETH_MNEMONIC" \
    --networkId="$ganache_net_id" \
    --blockTime=3 > ops/ganache.log &
  # Wait for ganache to start responding
  while [[ -z "`curleth net_version '[]'`" ]]
  do sleep 1
  done
fi

########################################
# migrate migration script

echo "Running migration script.."
echo

node ops/migrate.js

########################################
# In dev-mode, signal completion & start watchers

if [[ "$ETH_NETWORK" == "ganache" && "$1" == "yes" ]]
then
  signal_migrations_complete &
  watch
elif [[ "$ETH_NETWORK" == "ganache" && "$1" == "no" ]]
then
  signal_migrations_complete
fi
