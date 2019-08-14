#!/bin/bash
set -e

export ETH_RPC_URL="http://172.17.0.1:8545"
export NODE_URL="nats://172.17.0.1:4222"

tokenAddress="`cat address-book.json | jq '.["4447"].Token.address' | tr -d '"'`"

id="xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK"

# Make sure the recipient bot in the background exits when this script exits
function cleanup {
  docker container stop indra_v2_payment_bot_1 2> /dev/null || true
}
trap cleanup EXIT SIGINT

########################################
## Run Tests

echo;echo "Requesting eth collateral for recipient bot";echo;sleep 1

bash ops/payment-bot.sh -i 1 -q

echo;echo "Requesting token collateral for recipient bot";echo;sleep 1

bash ops/payment-bot.sh -i 1 -q -a $tokenAddress

echo;echo "Starting recipient bot in background, waiting for payments";echo;sleep 1

########################################
## If we're only acting as a recipient for ui tests, wait for transfers in foreground

if [[ "${1:0:1}" == "r" ]]
then
  bash ops/payment-bot.sh -i 1 -a $tokenAddress
  exit 0
fi

########################################
## Otherwise, fork to background and continue with bot tests

bash ops/payment-bot.sh -i 1 -a $tokenAddress &

sleep 5;echo;echo "Depositing eth into sender bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -d 0.1

sleep 1;echo;echo "Depositing tokens into sender bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -d 0.1 -a $tokenAddress

sleep 1;echo;echo "Sending eth to recipient bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -t 0.05 -c $id

sleep 1;echo;echo "Sending tokens to recipient bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -t 0.05 -c $id -a $tokenAddress

sleep 3;echo;echo "Tests finished successfully";echo
