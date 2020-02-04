#!/bin/bash
set -e

project="indra"

export STORE_DIR="./.test-store"
export INDRA_CLIENT_LOG_LEVEL="${INDRA_CLIENT_LOG_LEVEL:-2}"
export INDRA_ETH_RPC_URL="${INDRA_ETH_RPC_URL:-http://172.17.0.1:8545}"
export INDRA_ETH_MNEMONIC="${INDRA_ETH_MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"
export INDRA_NODE_URL="${INDRA_NODE_URL:-nats://172.17.0.1:4222}"
export INDRA_PG_DATABASE="${INDRA_PG_DATABASE:-$project}"
export INDRA_PG_HOST="${INDRA_PG_HOST:-172.17.0.1}"
export INDRA_PG_PASSWORD="${INDRA_PG_PASSWORD:-$project}"
export INDRA_PG_PORT="${INDRA_PG_PORT:-5432}"
export INDRA_PG_USERNAME="${INDRA_PG_USERNAME:-$project}"
export NODE_ENV="${NODE_ENV:-development}"

echo "Integration Tester Container launched!"
echo

function finish {
  echo && echo "Integration tester container exiting.." && exit
}
trap finish SIGTERM SIGINT

bash ops/wait-for.sh $INDRA_PG_HOST:$INDRA_PG_PORT
bash ops/wait-for.sh ${INDRA_ETH_RPC_URL#*://}
bash ops/wait-for.sh ${INDRA_NODE_URL#*://}

bundle=dist/tests.bundle.js

if [[ ! -f "$bundle" || "$NODE_ENV" == "development" ]]
then webpack --config ops/webpack.config.js
fi

if [[ $1 == "--watch" ]]
then
  webpack --watch --config ops/webpack.config.js &
  sleep 5 # give webpack a sec to finish the first watch-mode build
  mocha --timeout 60000 --bail --check-leaks --bail --watch $bundle
else
  mocha --timeout 60000 --bail --check-leaks --bail --exit $bundle
fi

rm -rf $STORE_DIR
