#!/usr/bin/env bash
set -e

project="indra_v2"
cypress="node_modules/.bin/cypress"

function cleanup {
  echo "Stopping the recipient payment bot..."
  if [[ -n "$bot_pid" ]]
  then kill $bot_pid
  fi
  docker container stop indra_v2_payment_bot_1 2> /dev/null || true
  echo "Done!"
}
trap cleanup EXIT SIGINT

n=15
echo "Starting the recipient bot & then we'll wait for $n seconds for it to get all set up..."
echo

# make sure no payment bot already exists before we start a new one
cleanup
bash ops/test-bot.sh recieve &
bot_pid=$!

# Make sure indra's installed while we wait for the recipient bot to do it's thing
$cypress install > /dev/null
sleep $n

# If there's no daicard service (webpack dev server) then indra's running in prod mode
if [[ -n "`docker service ls | grep indra_v2_daicard`" ]]
then env="--env=publicUrl=https://localhost"
else env="--env=publicUrl=http://localhost"
fi

if [[ "$1" == "watch" ]]
then $cypress open $env
else $cypress run $env --spec=cypress/tests/index.js --record=false
fi

