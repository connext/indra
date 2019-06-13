#!/bin/bash
set -e

echo "entry v6"
echo "Node entrypoint activated in env: `env`"

if [[ -d "modules/node" ]]
then cd modules/node
fi

if [[ -z "$INDRA_PG_PASSWORD" && -n "$INDRA_PG_PASSWORD_FILE" ]]
then export INDRA_PG_PASSWORD="`cat $INDRA_PG_PASSWORD_FILE`"
fi

if [[ -z "$NODE_MNEMONIC" && -n "$NODE_MNEMONIC_FILE" ]]
then export NODE_MNEMONIC="`cat $NODE_MNEMONIC_FILE`"
fi

exec ./node_modules/.bin/nodemon \
  --delay 1 \
  --exitcrash \
  --ignore *.test.ts \
  --legacy-watch \
  --polling-interval 1000 \
  --watch src \
  --exec ts-node \
  ./src/main.ts
