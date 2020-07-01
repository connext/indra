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

echo "Starting bot in env: LOG_LEVEL=$LOG_LEVEL | INDRA_ETH_RPC_URL=$INDRA_ETH_RPC_URL | INDRA_NODE_URL=$INDRA_NODE_URL"

farm_name="${project}_bot_farm"

if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

exec docker run \
  $interactive \
  --entrypoint="bash" \
  --env="INDRA_ETH_RPC_URL=$INDRA_ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$INDRA_NODE_URL" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  --name="$farm_name" \
  --publish="9231:9229" \
  --rm \
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
