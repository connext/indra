#!/bin/bash
set -e

project="indra"

export INDRA_CLIENT_LOG_LEVEL="${INDRA_CLIENT_LOG_LEVEL:-3}"
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

if [[ "$1" == "--watch" ]]
then command="exec jest --config jest.config.js --runInBand --watch" && shift
else command="jest --config jest.config.js --forceExit --runInBand"
fi

bash wait-for.sh $INDRA_PG_HOST:$INDRA_PG_PORT
bash wait-for.sh ${INDRA_ETH_RPC_URL#*://}
bash wait-for.sh ${INDRA_NODE_URL#*://}

$command $@
