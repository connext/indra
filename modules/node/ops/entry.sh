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

if [[ -z "$NODE_MNEMONIC" && -n "$NODE_MNEMONIC_FILE" ]]
then export NODE_MNEMONIC="`cat $NODE_MNEMONIC_FILE`"
fi

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

