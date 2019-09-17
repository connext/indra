#!/bin/bash
set -e

project="indra"
export ETH_RPC_URL="http://172.17.0.1:8545"
export NODE_URL="nats://172.17.0.1:4222"

divider="\n########################################"
tokenAddress="`cat address-book.json | jq '.["4447"].Token.address' | tr -d '"'`"

id="xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK"

# hardcode the mnemonics to the prefunded ones found in
# `migrate-contracts.js`
mnemonic1="humble sense shrug young vehicle assault destroy cook property average silent travel"
mnemonic2="roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult"

# Generate some random hex chunks to use in link payments
paymentId="0x`head -c32 /dev/urandom | xxd -p -c32`"
preImage="0x`head -c32 /dev/urandom | xxd -p -c32`"

# Make sure the recipient bot in the background exits when this script exits
function cleanup {
  docker container stop ${project}_payment_bot_1 2> /dev/null || true
  docker container stop ${project}_payment_bot_2 2> /dev/null || true
}
trap cleanup EXIT SIGINT

########################################
## Run Tests

echo -e "$divider";echo "Requesting eth collateral for recipient bot"
bash ops/payment-bot.sh -i 1 -q -m "$mnemonic1"

echo -e "$divider";echo "Requesting token collateral for recipient bot"
bash ops/payment-bot.sh -i 1 -q -a $tokenAddress -m "$mnemonic1"

########################################
## If we're only acting as a recipient for ui tests, wait for transfers in foreground

echo -e "$divider";echo "Starting recipient bot in background, waiting for payments"
if [[ "${1:0:1}" == "r" ]]
then
  bash ops/payment-bot.sh -i 1 -a $tokenAddress -m "$mnemonic1" -o
  exit 0
fi

########################################
## Otherwise, fork to background and continue with bot tests

bash ops/payment-bot.sh -i 1 -a $tokenAddress -m "$mnemonic1" -o &
sleep 5 # give recipient a sec to get set up

echo -e "$divider";echo "Depositing eth into sender bot"
bash ops/payment-bot.sh -i 2 -d 0.1 -m "$mnemonic2"

echo -e "$divider";echo "Depositing tokens into sender bot"
bash ops/payment-bot.sh -i 2 -d 0.1 -a $tokenAddress -m "$mnemonic2"

echo -e "$divider";echo "Sending eth to recipient bot"
bash ops/payment-bot.sh -i 2 -t 0.05 -c $id -m "$mnemonic2"

echo -e "$divider";echo "Sending tokens to recipient bot"
bash ops/payment-bot.sh -i 2 -t 0.05 -c $id -a $tokenAddress -m "$mnemonic2"

echo -e "$divider";echo "Generating a link payment"
bash ops/payment-bot.sh -i 2 -a $tokenAddress -l 0.01 -p "$paymentId" -h "$preImage" -m "$mnemonic2"

echo -e "$divider";echo "Stopping recipient listener so it can redeem a link payment"
cleanup

echo -e "$divider";echo "Starting sender in background so they can uninstall link transfer app"
bash ops/payment-bot.sh -i 2 -m "$mnemonic2" -o &
sleep 7

echo -e "$divider";echo "Redeeming link payment"
bash ops/payment-bot.sh -i 1 -a $tokenAddress -y 0.01 -p "$paymentId" -h "$preImage" -m "$mnemonic1"

echo -e "$divider";echo "Tests finished successfully"
echo
