#!/bin/bash
set -e

function wait_for {
  name=$1
  target=$2
  tmp=${target#*://} # remove protocol
  host=${tmp%%/*} # remove path if present
  if [[ ! "$host" =~ .*:[0-9]{1,5} ]] # no port provided
  then
    echo "$host has no port, trying to add one.."
    if [[ "${target%://*}" == "http" ]]
    then host="$host:80"
    elif [[ "${target%://*}" == "https" ]]
    then host="$host:443"
    else echo "Error: missing port for host $host derived from target $target" && exit 1
    fi
  fi
  echo "Waiting for $name ($host) to wake up..."
  bash ops/wait-for.sh -t 60 $host 2> /dev/null
}

wait_for "database" $POSTGRES_URL
wait_for "db migrations" ${POSTGRES_URL%:*}:5431
wait_for "ethprovider" $ETH_RPC_URL
wait_for "redis" $REDIS_URL

if [[ "$ETH_NETWORK" == "ganache" ]]
then wait_for "ethprovider migrations" ${ETH_RPC_URL%:*}:8544
fi

export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$POSTGRES_URL/$POSTGRES_DB"

if [[ "$NODE_ENV" == "development" ]]
then
  echo "Starting nodemon $1!"
  exec ./node_modules/.bin/nodemon \
    --delay 1 \
    --exitcrash \
    --ignore *.test.ts \
    --legacy-watch \
    --nolazy \
    --polling-interval 1000 \
    --watch src \
    -r ts-node/register \
    ./src/spankchain/main.ts $1
else
  echo "Starting node $1!"
  exec node dist/spankchain/main.js $1
fi
