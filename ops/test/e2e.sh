#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

chainid="$1"
echo "Starting bot test with options: $agents agents | interval $interval | limit $limit"

INDRA_CHAIN_URL="${INDRA_CHAIN_URL:-http://172.17.0.1:8545}"
INDRA_NODE_URL="${INDRA_NODE_URL:-http://172.17.0.1:3000}"

echo "Starting bot in env: LOG_LEVEL=$LOG_LEVEL | INDRA_CHAIN_URL=$INDRA_CHAIN_URL | INDRA_NODE_URL=$INDRA_NODE_URL"

tps_name="${project}_bot_tps"

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
  --name="$tps_name" \
  --publish="9231:9229" \
  --rm \
  --volume="$root:/root" \
  ${project}_builder -c '
    set -e
    echo "Bot tps launched!"
    cd modules/bot
    function finish {
      echo && echo "Bot tps exiting.." && exit
    }
    trap finish EXIT SIGTERM SIGINT
    node --inspect=0.0.0.0:9229 dist/src/index.js e2e \
      --funder-mnemonic $MNEMONIC \
      --chain-id '$chainid' \
      --log-level $LOG_LEVEL
  '
