#!/bin/bash
set -e

if [[ -d "modules/node" ]]
then cd modules/node
elif [[ ! -f "src/main.ts" && ! -f "dist/main.js" ]]
then echo "Fatal: couldn't find file to run" && exit 1
fi

if [[ -z "$INDRA_PG_PASSWORD" && -n "$INDRA_PG_PASSWORD_FILE" ]]
then export INDRA_PG_PASSWORD="`cat $INDRA_PG_PASSWORD_FILE`"
fi

if [[ -z "$INDRA_ETH_MNEMONIC" && -n "$INDRA_ETH_MNEMONIC_FILE" ]]
then
  echo "catting $INDRA_ETH_MNEMONIC_FILE -> `cat $INDRA_ETH_MNEMONIC_FILE`"
  export INDRA_ETH_MNEMONIC="`cat $INDRA_ETH_MNEMONIC_FILE`"
fi
echo "mnemonic: $INDRA_ETH_MNEMONIC"

database="$INDRA_PG_HOST:$INDRA_PG_PORT"
echo "Waiting for database ($database) to wake up..."
bash ops/wait-for.sh -t 60 $database 2> /dev/null

nats="${INDRA_NATS_SERVERS#*://}"
echo "Waiting for nats (${nats%,*}) to wake up..."
bash ops/wait-for.sh -t 60 ${nats%,*} 2> /dev/null

ethprovider="${INDRA_ETH_RPC_URL#*://}"
echo "Waiting for ethprovider ($ethprovider) to wake up..."
bash ops/wait-for.sh -t 60 $ethprovider 2> /dev/null

if [[ "$NODE_ENV" == "development" ]]
then
  exec ./node_modules/.bin/nodemon \
    --delay 1 \
    --exitcrash \
    --ignore *.test.ts \
    --legacy-watch \
    --polling-interval 1000 \
    --watch src \
    --exec ts-node \
    ./src/main.ts
else
  echo "Starting indra v2 node!"
  exec node dist/main.js
fi

