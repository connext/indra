#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

INDRA_ETH_RPC_URL="${INDRA_ETH_RPC_URL:-http://172.17.0.1:8545}"
INDRA_NODE_URL="${INDRA_NODE_URL:-http://172.17.0.1:8080}"
INDRA_NATS_URL="${INDRA_NATS_URL:-nats://172.17.0.1:4222}"

command='npm run start -- '"$@"''
echo $1

if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

docker run \
  --entrypoint="bash" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_ETH_RPC_URL=$INDRA_ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$INDRA_NODE_URL" \
  --env="INDRA_NATS_URL=$INDRA_NATS_URL" \
  $interactive \
  --name="${project}_bot_$1" \
  --rm \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "Bot container launched!"
    cd modules/bot
    export PATH=./node_modules/.bin:$PATH
    function finish {
      echo && echo "Bot container exiting.." && exit
    }
    trap finish SIGTERM SIGINT
    echo "Launching Bot!";echo
    '"$command"'
  '