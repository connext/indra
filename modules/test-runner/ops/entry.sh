#!/bin/bash
set -e

if [[ -d "modules/test-runner" ]]
then cd modules/test-runner
fi

cmd="${1:-test}"

# Set defaults in src/util/env instead of here
export INDRA_ADMIN_TOKEN="$INDRA_ADMIN_TOKEN"
export INDRA_CHAIN_PROVIDERS="$INDRA_CHAIN_PROVIDERS"
export INDRA_CLIENT_LOG_LEVEL="$INDRA_CLIENT_LOG_LEVEL"
export INDRA_CONTRACT_ADDRESSES="$INDRA_CONTRACT_ADDRESSES"
export INDRA_NATS_URL="$INDRA_NATS_URL"
export INDRA_NODE_URL="$INDRA_NODE_URL"

export NODE_ENV="${NODE_ENV:-development}"

########################################
# Wait for indra stack dependencies

function wait_for {
  name=$1
  target=$2
  tmp=${target#*://} # remove protocol
  host=${tmp%%/*} # remove path if present
  if [[ ! "$host" =~ .*:[0-9]{1,5} ]] # no port provided
  then
    echo "$host has no port, trying to add one.."
    if [[ "${target%://*}" == "http" ]]
    then host="$host:80"
    elif [[ "${target%://*}" == "https" ]]
    then host="$host:443"
    else echo "Error: missing port for host $host derived from target $target" && exit 1
    fi
  fi
  echo "Waiting for $name at $target ($host) to wake up..."
  wait-for -t 60 $host 2> /dev/null
}

wait_for "node" "$INDRA_NODE_URL"
wait_for "nats" "$INDRA_NATS_URL"

########################################
# Launch tests

bundle=dist/tests.bundle.js

if [[ ! -f "$bundle" ]]
then webpack --config ops/webpack.config.js
fi

if [[ "$NODE_ENV" == "production" ]]
then noOnly="--forbid-only"
else noOnly=""
fi

if [[ "$cmd" == "watch" ]]
then
  echo "Starting test-watcher"
  webpack --watch --config ops/webpack.config.js &
  sleep 5 # give webpack a sec to finish the first watch-mode build
  mocha --slow 1000 --timeout 180000 --bail --check-leaks --watch $bundle
else
  echo "Starting test-runner"
  mocha --slow 1000 --timeout 180000 --bail --check-leaks --exit $noOnly $bundle
fi
