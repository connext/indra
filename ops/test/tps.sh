#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

# make sure a network for this project has been created
docker swarm init 2> /dev/null || true
docker network create --attachable --driver overlay $project 2> /dev/null || true

agents="$1"
interval="$2"
limit="$3"
echo "Starting bot test with options: $agents agents | interval $interval | limit $limit"

INDRA_CHAIN_URL="${INDRA_CHAIN_URL:-http://172.17.0.1:8545}"
INDRA_NODE_URL="${INDRA_NODE_URL:-http://indra}"

echo "Starting bot in env: LOG_LEVEL=$LOG_LEVEL | INDRA_CHAIN_URL=$INDRA_CHAIN_URL | INDRA_NODE_URL=$INDRA_NODE_URL"

if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

exec docker run \
  $interactive \
  --entrypoint="bash" \
  --env="INDRA_CHAIN_URL=$INDRA_CHAIN_URL" \
  --env="INDRA_NODE_URL=$INDRA_NODE_URL" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  --env="MNEMONIC=$MNEMONIC" \
  --name="${project}_bot_tps" \
  --network="$project" \
  --publish="9231:9229" \
  --rm \
  --volume="$root:/root" \
  ${project}_builder -c '
    cd modules/bot
    node --inspect=0.0.0.0:9229 dist/src/index.js tps \
      --concurrency "'$agents'" \
      --funder-mnemonic $MNEMONIC \
      --interval "'$interval'" \
      --limit "'$limit'" \
      --log-level "$LOG_LEVEL"
  '
