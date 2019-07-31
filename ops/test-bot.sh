#!/bin/bash
set -e

export ETH_RPC_URL="http://172.17.0.1:8545"
export NODE_URL="nats://172.17.0.1:4222"

tokenAddress="`cat address-book.json | jq '.["4447"].Token.address' | tr -d '"'`"

id="xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK"

function cleanup {
  echo "Stopping the recipient payment bot..."
  docker container stop indra_v2_payment_bot_1
}
trap cleanup EXIT

########################################
## Run Tests

echo;echo "Starting recipient payment bot";echo;sleep 1

# output's gets weird, idk why. Fixed by sprinkling in some extra \r
bash ops/payment-bot.sh -i 1 -q | tr '\n' '\r\n' &

sleep 10;echo;echo "Depositing eth into sender bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -d 0.1

sleep 1;echo;echo "Depositing tokens into sender bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -d 0.1 -a $tokenAddress

sleep 1;echo;echo "Sending eth to recipient bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -t 0.05 -c $id

exit # token transfers are broken right now..

sleep 1;echo;echo "Sending tokens to recipient bot";echo;sleep 1

bash ops/payment-bot.sh -i 2 -t 0.05 -c $id -a $tokenAddress

