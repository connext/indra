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
links=${NUMBER_LINKS:-5}

if ! (($NUMBER_BOTS)); then
  echo;echo "Must supply a number of bots to test with";
  exit 0;
fi

# generate mnemonics and fund them
# NOTE: this will obviously only ever work on ganache
# NOTE 2: idk how to make this hit docker good
eth_rpc="${ETH_RPC_URL:-http://localhost:8545}"
sugar_daddy="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
node ops/generateBots.js $bots "$sugar_daddy" $eth_rpc $tokenAddress || { echo;echo "Problem generating or funding bots. Exiting"; exit 1; }

# generate several links
if (($links)); then
  node ops/generateLinks.js $links
fi

# create recipients and senders arrays
recipientXpubs=()
recipientMnemonics=()
senderXpubs=()
senderMnemonics=()

for i in $(seq 1 $bots);
do
  botMnemonic="`cat bots.json | jq -r --arg key "$i" '.[$key].mnemonic'`"
  # echo;echo $botMnemonic
  xpub="`cat bots.json | jq -r --arg key "$i" '.[$key].xpub'`"
  # echo;echo $xpub

  # for 1/4 of bots, request collateral in background
  if ! (($i % 2)); then
    recipientXpubs+=("$xpub")
    recipientMnemonics+=("$botMnemonic")

    echo;echo "Requesting token collateral for recipient bot";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -a $tokenAddress -m "${botMnemonic}" -q


    echo;echo "Requesting eth collateral for recipient bot";echo;sleep 5
    sleep 5;bash ops/payment-bot.sh -i ${xpub} -m "${botMnemonic}" -q
  
  else
    senderXpubs+=("$xpub")
    senderMnemonics+=("$botMnemonic")

    # for remaining bots, start and deposit, they will be senders
    sleep 5;echo;echo "Depositing tokens into sender bot";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -a $tokenAddress -m "${botMnemonic}" -d 0.1


    sleep 5;echo;echo "Depositing eth into sender bot";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -m "${botMnemonic}" -d 0.1

  fi
done

# start up the recipient bots to receive payments
for i in $(seq 1 ${#recipientXpubs[@]});
do
  xpub=${recipientXpubs[$((i - 1))]}
  mnemonic=${recipientMnemonics[$((i - 1))]}

  echo;echo "Starting recipient bots";echo;sleep 5
  bash ops/payment-bot.sh -i ${xpub} -m "${mnemonic}" &

done

# for all the senders, transfer to a random counterparty,
# create linked payments and have random recievers redeem
# them
for i in $(seq 1 ${#senderXpubs[@]});
do

  xpub=${senderXpubs[$((i - 1))]}
  mnemonic=${senderMnemonics[$((i - 1))]}

  # get id for counterparty at random
  length=${#recipientXpubs[@]}
  if [ "$length" -eq "0" ]; then
    echo "No recipients found"
    exit 0;
  fi

  counterpartyIndex=$(($RANDOM % $length))
  counterparty=${recipientXpubs[$counterpartyIndex]}

  sleep 5;echo;echo "Sending eth to random recipient bot";echo;sleep 1
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty} -m "${mnemonic}"


  sleep 5;echo;echo "Sending tokens to random recipient bot";echo;sleep 1
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty} -a ${tokenAddress} -m "${mnemonic}"

done

# create and redeem links if required
if (($links)); then
  xpub=${senderXpubs[$1]}
  mnemonic=${senderMnemonics[$1]}
  for i in $(seq 1 $links);
  do
    preImage="`cat links.json | jq -r --arg key "$i" '.[$key].preImage'`"
    paymentId="`cat links.json | jq -r --arg key "$i" '.[$key].paymentId'`"
    echo;echo "preImage";echo $paymentId
    echo "paymentId";echo $paymentId

    # generate the payment from a single sender
    # NOTE: make sure whichever sender is generating these links has
    # the appropriate deposit to do so. The links are by default very
    # low value, but this is important to keep in mind if weird errors
    # pop up. (Default collateralized with > 1000 tokens)
    sleep 5;echo;echo "Generating a linked payment";echo;sleep 1
    bash ops/payment-bot.sh -i ${xpub} -a ${tokenAddress} -m "${mnemonic}" -l 0.001 -p ${paymentId} -pr ${preImage} 
  done

  # redeem links from random receivers

fi