#!/bin/bash

########################################
# env setup

ganache_net_id=4447
ganache_rpc_port=8545
migration_flag_port=8544

#export ETH_MNEMONIC="$ETH_MNEMONIC"
#export ETH_NETWORK="$ETH_NETWORK"
#export ETH_PROVIDER="$ETH_PROVIDER"
#export INFURA_KEY=$INFURA_KEY
#export PRIVATE_KEY_FILE="$PRIVATE_KEY_FILE"

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

exit

########################################
# TODO: delete this

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
    echo "Network $ETH_NETWORK doesn't match chain id ($netid) of provider: $ETH_PROVIDER"
    exit 1
  fi
}

function getAddress {
  cat ops/addresses.json | jq ".$1.networks[\"$2\"].address"
}

function getHash {
  find contracts migrations ops/addresses.json -type f -not -name "*.swp" \
    | xargs cat | sha256sum | tr -d ' -'
}

function migrate {
  echo && echo "Migrating contracts to network $ETH_NETWORK" 
  ./node_modules/.bin/truffle migrate --verbose-rpc --reset --network=$ETH_NETWORK
  echo "Migrations complete, exit code: $?"
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
# Make some sanity checks

if [[ -z "$ETH_PROVIDER" ]]
then echo "ETH_PROVIDER env var not available, aborting" && exit
else echo "Preparing migrations for $ETH_NETWORK against provider: $ETH_PROVIDER"
fi

netid="`curleth net_version '[]'`"

checkNetwork $ETH_NETWORK $netid

########################################
# Decide whether or not to migrate

ECToolsAddress="`getAddress ECTools $netid`"
ChannelManagerAddress="`getAddress ChannelManager $netid`"

ExpectedECToolsCode="`cat build/contracts/ECTools.json | jq .deployedBytecode | tr -d '"'`"
ExpectedChannelManagerCode="`cat build/contracts/ChannelManager.json | jq .deployedBytecode | tr -d '"'`"

shouldMigrate="no"

# If this network doesn't have addresses for either of these contracts, then migrate

# If this network ha addresses for these contracts but the code is different, them re-migrate

if [[ "${#ECToolsAddress}" == "42" ]]
then
  ECToolsCode="`curleth eth_getCode '[\"'"$ECToolsAddress"'\",\"latest\"]'`"
fi

if [[ "${#ChannelManagerAddress}" == "42" ]]
then
  ChannelManagerCode="`curleth eth_getCode '[\"'"$ChannelManagerAddress"'\",\"latest\"]'`"
fi

echo "ECToolsAddress=$ECToolsAddress"
echo "ChannelManagerAddress=$ChannelManagerAddress"
echo "ECToolsCode=$ECToolsCode"
echo "ChannelManagerCode=$ChannelManagerCode"

if [[ "${#ECToolsAddress}" != "42" || "${#ChannelManagerAddress}" != "42" ]]
then shouldMigrate="yes"
fi

########################################
# Migrate

echo "eth_accounts returns: `curleth 'eth_accounts' '[]'`"

if [[ "$shouldMigrate" == "yes" ]]
then echo "Migrations activated!" && migrate
fi

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
