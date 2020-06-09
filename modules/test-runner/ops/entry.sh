#!/bin/bash
set -e

project="indra"
cmd="${1:-test}"

export STORE_DIR="./.test-store"
export INDRA_CLIENT_LOG_LEVEL="${INDRA_CLIENT_LOG_LEVEL:-0}"
export INDRA_ETH_RPC_URL="${INDRA_ETH_RPC_URL:-http://ethprovider:8545}"
export INDRA_ETH_MNEMONIC="${INDRA_ETH_MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"
export INDRA_NODE_URL="${INDRA_NODE_URL:-http://node:8080}"
export INDRA_NATS_URL="${INDRA_NATS_URL:-nats://nats:4222}"
export INDRA_PG_DATABASE="${INDRA_PG_DATABASE:-$project}"
export INDRA_PG_HOST="${INDRA_PG_HOST:-database}"
export INDRA_PG_PASSWORD="${INDRA_PG_PASSWORD:-$project}"
export INDRA_PG_PORT="${INDRA_PG_PORT:-5432}"
export INDRA_PG_USERNAME="${INDRA_PG_USERNAME:-$project}"
export INDRA_REDIS_URL="${INDRA_REDIS_URL:-redis://redis:6379}"
export NODE_ENV="${NODE_ENV:-development}"

echo "Integration Tester Container launched!"
echo

function finish {
  echo && echo "Integration tester container exiting.." && exit
}
trap finish SIGTERM SIGINT

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

wait_for "database" "$INDRA_PG_HOST:$INDRA_PG_PORT"
wait_for "ethprovider" "$INDRA_ETH_RPC_URL"
wait_for "node" "$INDRA_NODE_URL"
wait_for "redis" "$INDRA_REDIS_URL"
wait_for "nats" "$INDRA_NATS_URL"

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
  webpack --watch --config ops/webpack.config.js &
  sleep 5 # give webpack a sec to finish the first watch-mode build
  mocha --slow 1000 --timeout 180000 --bail --check-leaks --watch $bundle
else
  mocha --slow 1000 --timeout 180000 --bail --check-leaks --exit $noOnly $bundle
fi

rm -rf $STORE_DIR
