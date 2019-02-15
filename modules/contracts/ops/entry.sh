#!/bin/bash

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

########################################
# Setup some helper functions

function getHash {
  find build/contracts contracts migrations -type f -not -name "*.swp" \
    | xargs cat | sha256sum | tr -d ' -'
}

function migrate {
  echo && echo "Migration activated! New state: `getHash`" 
  ./node_modules/.bin/truffle compile
  ./node_modules/.bin/truffle migrate --reset --network=ganache
  getHash > build/state-hash
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
  do
    if [[ "`getHash`" == "`cat build/state-hash`" ]]
    then sleep 2
    else migrate
    fi
  done
}

########################################
# Migrate (& maybe start watcher)

# Start ganache if we're in dev-mode
if [[ "$network" == "ganache" ]]
then
  mkdir -p /data build/contracts
  ganache=./node_modules/.bin/ganache-cli
  echo "Starting Ganache with netid=$netid"
  $ganache \
    --host="0.0.0.0" \
    --port="$ganache_rpc_port" \
    --db="/data" \
    --mnemonic="$mnemonic" \
    --networkId="$ganache_net_id" \
    --blockTime=3 > ops/ganache.log &
  sleep 5

  # Do we need to do an initial migration?
  if [[ "`getHash`" != "`cat build/state-hash || true`" ]]
  then migrate
  else echo "Contracts & migrations are up to date"
  fi

  if [[ "$1" == "yes" ]]
  then
    signal_migrations_complete &
    watch
  else
    signal_migrations_complete
  fi

else
  echo "Deploying in prod or staging mode"

  export API_KEY=$API_KEY
  export ETH_PROVIDER=$ETH_PROVIDER
  export ETH_NETWORK_ID=$ETH_NETWORK_ID

  # TODO sanity check: does our given net id match what our provider gives us?
  ./node_modules/.bin/truffle migrate --reset --network=$network
fi
