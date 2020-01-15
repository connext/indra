#!/bin/bash
set -e

project="indra"

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

if [[ $@ == *"--watch"* ]]
then
  webpack --watch --config ops/webpack.config.js &
  mocha --watch --timeout 30000 dist/tests.bundle.js
else
  mocha --exit --timeout 30000 dist/tests.bundle.js
fi

