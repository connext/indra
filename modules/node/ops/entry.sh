#!/bin/bash
set -e

echo "entry v6"
echo "Node entrypoint activated in env: `env`"

if [[ -d "modules/node" ]]
then cd modules/node
fi

if [[ -z "$INDRA_PG_PASSWORD" ]]
then export INDRA_PG_PASSWORD="`cat $INDRA_PG_PASSWORD_FILE`"
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
