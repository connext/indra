#!/usr/bin/env bash
set -e

agents="$1"
interval="$2"
limit="$3"
echo "Starting bot test with options: $agents agents | interval $interval | limit $limit"

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

INDRA_ETH_RPC_URL="${INDRA_ETH_RPC_URL:-http://172.17.0.1:3000/api/ethprovider}"
INDRA_NODE_URL="${INDRA_NODE_URL:-http://172.17.0.1:3000/api}"
INDRA_NATS_URL="${INDRA_NATS_URL:-nats://172.17.0.1:4222}"
BOT_REGISTRY_URL="${BOT_REGISTRY_URL:-http://172.17.0.1:3333}"

echo "Starting bot in env: LOG_LEVEL=$LOG_LEVEL | INDRA_ETH_RPC_URL=$INDRA_ETH_RPC_URL | INDRA_NODE_URL=$INDRA_NODE_URL"

registry_name="${project}_bot_registry"
farm_name="${project}_bot_farm"
agent_name="${project}_bot"

# Kill the dependency containers when this script exits
function cleanup {
  exit_code="0"
  echo;

  if [[ -n "`docker container ls -a | grep $farm_name`" ]]
  then
    echo "Stopping $farm_name.."
    docker container stop $farm_name &> /dev/null || true
    agent_code="`docker container inspect $farm_name | jq '.[0].State.ExitCode'`"
    if [[ "$agent_code" != "0" ]]
    then
      echo "Bot farm failed with exit code $agent_code"
      exit_code=1;
    fi
    docker container rm $farm_name &> /dev/null || true
  fi

  if [[ -n "`docker container ls -a | grep $registry_name`" ]]
  then
    echo "Stopping $registry_name.."
    docker container stop $registry_name &> /dev/null || true
    agent_code="`docker container inspect $registry_name | jq '.[0].State.ExitCode'`"
    docker container rm $registry_name &> /dev/null || true
  fi

  exit $exit_code
}
trap cleanup EXIT SIGINT

if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

echo "Starting bot registry container"
docker run \
  $interactive \
  --detach \
  --entrypoint="bash" \
  --name="$registry_name" \
  --publish "3333:3333" \
  --publish="9230:9229" \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "Bot registry launched!"
    cd modules/bot
    function finish {
      echo && echo "Bot registry exiting.." && exit
    }
    trap finish EXIT SIGTERM SIGINT
    node --inspect=0.0.0.0:9229 dist/src/registry.js
  '
docker logs --follow $registry_name &

docker run \
  $interactive \
  --entrypoint="bash" \
  --env="BOT_REGISTRY_URL"="$BOT_REGISTRY_URL" \
  --env="INDRA_ETH_RPC_URL=$INDRA_ETH_RPC_URL" \
  --env="INDRA_NATS_URL=$INDRA_NATS_URL" \
  --env="INDRA_NODE_URL=$INDRA_NODE_URL" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  --name="$farm_name" \
  --publish="9231:9229" \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "Bot farm launched!"
    cd modules/bot
    function finish {
      echo && echo "Bot farm exiting.." && exit
    }
    trap finish EXIT SIGTERM SIGINT
    node --inspect=0.0.0.0:9229 dist/src/index.js farm \
      --concurrency '$agents' \
      --interval '$interval' \
      --limit '$limit' \
      --log-level $LOG_LEVEL
  '
