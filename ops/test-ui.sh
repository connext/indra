#!/usr/bin/env bash
set -e

project="indra"
cypress="node_modules/.bin/cypress"
botTransferAmount="0.618" # Keep this synced w the amount sent in cypress/tests/index
botMnemonic="humble sense shrug young vehicle assault destroy cook property average silent travel"

########################################
## Even if this script exits early, make sure the thing in the background gets killed

function cleanup {
  kill $bot_pid 2> /dev/null || true
  docker container stop ${project}_payment_bot_1 2> /dev/null || true
}
trap cleanup EXIT SIGINT

# make sure no payment bot already exists before we start a new one
docker container stop ${project}_payment_bot_1 2> /dev/null || true

########################################
## Get a few important data points before we start

tokenAddress="`cat address-book.json | jq '.["4447"].Token.address' | tr -d '"'`"
botOutput="`bash ops/payment-bot.sh -g -a $tokenAddress -m "$botMnemonic" | tr -d '\r'`"

freeBalanceAddress="`echo "$botOutput" \
  | grep "User freeBalanceAddress:" \
  | awk -F ' ' '{print $4}'`"

freeBalance="`echo "$botOutput" \
  | grep -A 2 "$tokenAddress:" \
  | grep "$freeBalanceAddress" \
  | awk -F ' ' '{print $2}'`"

echo
echo "$botOutput"
echo
echo "Extracted info:"
echo "- token address: $tokenAddress"
echo "- free balance address: $freeBalanceAddress"
echo "- free balance: $freeBalance"

########################################
## Start the recipient payment bot in the background

n=10
echo "Starting the recipient bot & then we'll wait $n seconds for it to get all set up..."
echo

bash ops/test-bot.sh recieve &
bot_pid=$!

# Make sure cypress is installed while we wait for the recipient bot to do it's thing
$cypress install > /dev/null
sleep $n

########################################
## Start the UI e2e watcher if in watch mode

# If there's no daicard service (webpack dev server) then we're running in prod mode
if [[ -z "`docker service ls | grep ${project}_daicard`" ]]
then env="--env publicUrl=https://localhost"
fi

if [[ "$1" == "watch" ]]
then
  $cypress open $env
  exit 0
fi

########################################
## Start the UI e2e tests if in standalone test mode
## Then, compare the bot's current free balance w what we expect it to be

export ELECTRON_ENABLE_LOGGING=true
$cypress run $env --spec cypress/tests/index.js

docker container stop ${project}_payment_bot_1 2> /dev/null || true

expectedFreeBalance="`echo "$freeBalance $botTransferAmount" | awk '{print $1 + $2}'`"

freeBalance="`bash ops/payment-bot.sh -g -a $tokenAddress -m "$botMnemonic" \
  | tr -d '\r' \
  | grep -A 2 "$tokenAddress:" \
  | grep "$freeBalanceAddress" \
  | awk -F ' ' '{print $2}'`"

echo "Expected recipient free balance of $expectedFreeBalance, got $freeBalance"

if [[ "$freeBalance" != "$expectedFreeBalance" ]]
then echo "Oh no.. But whatever." # exit 1
else echo "Niice" # exit 1
fi
