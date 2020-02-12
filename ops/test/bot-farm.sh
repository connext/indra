#!/user/bin/env bash
set -e -o pipefail

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

########################################
## Env and variable setup

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
tokenAddress="`cat address-book.json | jq '.["4447"].Token.address' | tr -d '"'`"
numBots=${NUMBER_BOTS:-3};
botsFile="bots.json"
numLinks=${NUMBER_LINKS:-2}
linksFile="links.json"
eth_rpc="${ETH_RPC_URL:-http://localhost:8545}"
sugar_daddy="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
divider="\n########################################"

if [[ ! -d "./node_modules/ethers" || ! -d "./node_modules/openzeppelin-solidity" ]]
then npm i --no-save ethers openzeppelin-solidity
fi

########################################
## Helper Functions

# Make sure the recipient bot in the background exits when this script exits
function cleanup {
  botIds="`docker ps --filter name=${project}_payment_bot* -aq`"
  echo "Shutting down recipient bots: $botIds"
  if [[ -n "$botIds" ]]
  then echo "$botIds" | xargs docker container stop
  else echo "nvmd none are running"
  fi
}
trap cleanup EXIT SIGINT

########################################
## Setup bots and links

# generate mnemonics and fund them
# NOTE: this will obviously only ever work on ganache
# NOTE 2: idk how to make this hit docker good

node ops/generateBots.js $numBots "$sugar_daddy" $eth_rpc $tokenAddress $botsFile || { echo;echo "Problem generating or funding bots. Exiting"; exit 1; }
node ops/generateLinks.js $numLinks $linksFile

########################################
## Request collateral for recipients, deposit funds for senders

# create recipients and senders arrays
recipientXpubs=()
recipientMnemonics=()
senderXpubs=()
senderMnemonics=()

for i in $(seq 1 $numBots);
do
  botMnemonic="`cat $botsFile | jq -r --arg key "$i" '.[$key].mnemonic'`"
  xpub="`cat $botsFile | jq -r --arg key "$i" '.[$key].xpub'`"
  # for some bots, request collateral in background
  if ! (($i % 3)); then
    recipientXpubs+=("$xpub")
    recipientMnemonics+=("$botMnemonic")
    echo -e "$divider";echo "Requesting token collateral for recipient bot $i"
    bash ops/payment-bot.sh -i ${xpub} -a $tokenAddress -m "${botMnemonic}" -q
    echo -e "$divider";echo "Requesting eth collateral for recipient bot $i"
    bash ops/payment-bot.sh -i ${xpub} -m "${botMnemonic}" -q
  # for remaining bots, deposit some eth & tokens, they will be senders
  else
    senderXpubs+=("$xpub")
    senderMnemonics+=("$botMnemonic")
    echo -e "$divider";echo "Depositing tokens into sender bot $i"
    bash ops/payment-bot.sh -i ${xpub} -a $tokenAddress -m "${botMnemonic}" -d 10
    echo -e "$divider";echo "Depositing eth into sender bot $i"
    bash ops/payment-bot.sh -i ${xpub} -m "${botMnemonic}" -d 0.05
  fi
done

########################################
# Have the first sender create some link payments

xpub=${senderXpubs[$1]}
mnemonic=${senderMnemonics[$1]}
for i in $(seq 1 $numLinks);
do
  preImage="`cat $linksFile | jq -r --arg key "$i" '.[$key].preImage'`"
  paymentId="`cat $linksFile | jq -r --arg key "$i" '.[$key].paymentId'`"
  # generate the payment from a single sender
  # NOTE: make sure whichever sender is generating these links has
  # the appropriate deposit to do so. The links are by default very
  # low value, but this is important to keep in mind if weird errors
  # pop up. (Default collateralized with > 1000 tokens)
  echo -e "$divider";echo "Generating a linked payment from preImage: $preImage and paymentId: $paymentId"
  bash ops/payment-bot.sh -i ${xpub} -a ${tokenAddress} -m "${mnemonic}" -l 0.01 -p "${paymentId}" -h "${preImage}"
done

########################################
# Have random receivers redeem the link payments

for i in $(seq 1 $numLinks);
do
  length=${#recipientXpubs[@]}
  if [[ "$length" -eq "0" ]]
  then echo "No recipients found" && exit 0;
  fi
  preImage="`cat $linksFile | jq -r --arg key "$i" '.[$key].preImage'`"
  paymentId="`cat $linksFile | jq -r --arg key "$i" '.[$key].paymentId'`"
  redeemerIndex=$(($RANDOM % $length)) # get id for counterparty at random
  xpub=${recipientXpubs[$redeemerIndex]}
  mnemonic=${recipientMnemonics[$redeemerIndex]}
  echo -e "$divider";echo "Redeeming link from randomly selected recipient bot: $xpub"
  echo "Linked payment has preImage: $preImage and paymentId: $paymentId"
  # TODO: link creator should be online too so the node can properly uninstall
  bash ops/payment-bot.sh -i ${xpub} -a ${tokenAddress} -m "${mnemonic}" -y 0.01 -p "${paymentId}" -h "${preImage}" &
  # also have sender try to send payments while redeeming
  echo -e "$divider";echo "Sending tokens payment to randomly selected recipient bot: $xpub"
  bash ops/payment-bot.sh -i ${senderXpubs[$1]} -t 0.01 -c ${xpub} -m "${senderMnemonics[$1]}" -a ${tokenAddress}
  sleep 10 # give above actions a sec to finish
done

########################################
## Start recipient bots in the background

# start up the recipient bots to receive payments
for i in $(seq 1 ${#recipientXpubs[@]});
do
  xpub=${recipientXpubs[$((i - 1))]}
  mnemonic=${recipientMnemonics[$((i - 1))]}
  echo -e "$divider";echo "Starting recipient bots"
  bash ops/payment-bot.sh -i ${xpub} -m "${mnemonic}" -o &
  sleep 7 # give each recipient bot a few seconds to start up
done

########################################
# for all the senders, transfer to a random counterparty,

for i in $(seq 1 ${#senderXpubs[@]});
do
  xpub=${senderXpubs[$((i - 1))]}
  mnemonic=${senderMnemonics[$((i - 1))]}
  length=${#recipientXpubs[@]}
  if [[ "$length" -eq "0" ]]
  then echo "No recipients found" && exit 0;
  fi
  counterpartyIndex=$(($RANDOM % $length)) # get id for counterparty at random
  counterparty=${recipientXpubs[$counterpartyIndex]}
  echo -e "$divider";echo "Sending eth to randomly selected recipient bot $counterparty"
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty} -m "${mnemonic}"
  echo -e "$divider";echo "Sending tokens to randomly selected recipient bot $counterparty"
  bash ops/payment-bot.sh -i ${xpub} -t 0.05 -c ${counterparty} -a ${tokenAddress} -m "${mnemonic}"
done

echo 'All Done! Yay!'
