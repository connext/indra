#!/user/bin/env bash
set -e

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Make sure the recipient bot in the background exits when this script exits
function cleanup {
  docker ps --filter name=indra_v2_payment_bot* -aq | xargs docker container stop
}
trap cleanup EXIT SIGINT

# set token address
tokenAddress="`cat address-book.json | jq '.["4447"].Token.address' | tr -d '"'`"

# set the number of bots you would like to test with
bots=$NUMBER_BOTS;

# generate mnemonics and fund them
# NOTE: this will obviously only ever work on ganache
# NOTE 2: idk how to make this hit docker good
eth_rpc="${ETH_RPC_URL:-http://localhost:8545}"
sugar_daddy="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
node ops/generateBots.js $bots "$sugar_daddy" $eth_rpc $tokenAddress

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

  xpub=${senders[$i]}
  echo "sender";echo ${xpub}

  # get id for counterparty at random
  length=${#recipients[@]}
  counterpartyIndex=$(($RANDOM % $length))
  counterparty=${recipients[$counterpartyIndex]}
  echo "recipient";echo ${counterparty}

  sleep 1;echo;echo "Sending eth to random recipient bot";echo;sleep 1
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty}


  sleep 1;echo;echo "Sending tokens to random recipient bot";echo;sleep 1
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty} -a ${tokenAddress}

done