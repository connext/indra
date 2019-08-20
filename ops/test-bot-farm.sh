#!/user/bin/env bash

# Make sure the recipient bot in the background exits when this script exits
function cleanup {
  docker ps --filter name=indra_v2_payment_bot* -aq | xargs docker container stop
}
trap cleanup EXIT SIGINT

# set token address
tokenAddress="`cat address-book.json | jq '.["4447"].Token.address' | tr -d '"'`"

# set the number of bots you would like to test with
bots=$NUMBER_BOTS;

# generate mnemonics
node ops/generateBots.js $bots

# create a recipients array
recipients=()
senders=()

for i in $(seq 1 $bots);
do
  botMnemonic="`cat bots.json | jq -r --arg key "$i" '.[$key].mnemonic'`"
  # echo;echo $botMnemonic
  xpub="`cat bots.json | jq -r --arg key "$i" '.[$key].xpub'`"
  # echo;echo $xpub

  # for 1/4 of bots, request collateral in background
  if ! (($i % 4)); then
    recipients+=("$xpub")

    echo;echo "Requesting token collateral for recipient bot";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -a $tokenAddress -m "${botMnemonic}" -q


    echo;echo "Requesting eth collateral for recipient bot";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -m "${botMnemonic}" -q
  
  else
  # for remaining bots, start and deposit, they will be senders
    sleep 5;echo;echo "Depositing tokens into sender bot";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -a $tokenAddress -m "${botMnemonic}" -d 0.1 &


    sleep 5;echo;echo "Depositing eth into sender bot";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -m "${botMnemonic}" -d 0.1 &

    senders+=("$xpub")

  fi
done

# for all the senders, transfer to a random counterparty
for i in $(seq 1 ${#senders[@]}):
do

  # get id for counterparty at random
  length=${#recipients[@]}
  counterpartyIndex=$(($RANDOM % $length))
  counterparty=${recipients[$counterpartyIndex]}

  sleep 1;echo;echo "Sending eth to random recipient bot";echo;sleep 1
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty}


  sleep 1;echo;echo "Sending tokens to random recipient bot";echo;sleep 1
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty} -a ${tokenAddress}

done