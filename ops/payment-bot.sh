#!/user/bin/env bash
set -e

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

########################################
## Useful values according to Layne
# bot 1 deposit addr on kovan:
# 0x24ac59b070ec2ea822249cb2a858208460305faa

# bot 2 deposit addr on kovan:
# 0xa0ae1a3d4ff42ae77154fb9ebbca0af2b5b7f357

# kovan token addr:
# 0xFab46E002BbF0b4509813474841E0716E6730136

# faucent link:
# https://erc20faucet.com/

########################################
## Setup env vars

project="indra"
cwd="`pwd`"
args="$@"
identifier=1
while [ "$1" != "" ]; do
    case $1 in
        -i | --identifier )     shift
                                identifier=$1
                                ;;
        -m | --mnemonic )       shift
                                mnemonic=$1
                                ;;
    esac
    shift
done

DB_FILENAME="${DB_FILENAME:-.payment-bot-db/$identifier.json}"
ETH_RPC_URL="${ETH_RPC_URL:-http://172.17.0.1:8545}"
NODE_URL="${NODE_URL:-nats://172.17.0.1:4222}"
WEBDIS_URL="${REDIS_URL:-redis://172.17.0.1:6379}"
PISA_URL="${PISA_URL:-http://172.17.0.1:5487}"
PISA_CONTRACT_ADDRESS="${PISA_CONTRACT_ADDRESS:-0x0000000000000000000000000000000000000000}"

# Damn I forget where I copy/pasted this witchcraft from, yikes.
# It's supposed to find out whether we're calling this script from a shell & can print stuff
# Or whether it's running in the background of another script and can't attach to a screen
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

if [ -z "$mnemonic" ] && [ "$identifier" == 1 ]
then
  mnemonic="humble sense shrug young vehicle assault destroy cook property average silent travel"
elif [ -z "$mnemonic" ] && [ "$identifier" == 2 ]
then
  mnemonic="roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult"
fi

bash ops/wait-for.sh ${ETH_RPC_URL#*://} 2> /dev/null

########################################
## Launch payment bot

docker run \
  --entrypoint="bash" \
  --env="DB_FILENAME=$DB_FILENAME" \
  --env="ECCRYPTO_NO_FALLBACK=true" \
  --env="ETH_RPC_URL=$ETH_RPC_URL" \
  --env="MNEMONIC=$mnemonic" \
  --env="NODE_URL=$NODE_URL" \
  --env="WEBDIS_URL=$WEBDIS_URL" \
  --env="PISA_URL=$PISA_URL" \
  --env="PISA_CONTRACT_ADDRESS=$PISA_CONTRACT_ADDRESS" \
  $interactive \
  --name="${project}_payment_bot_$identifier" \
  --rm \
  --tty \
  --user="`id -u`:`id -g`" \
  --volume="`pwd`:/root" \
  --workdir="/root" \
  ${project}_builder -c '
    set -e
    cd modules/payment-bot
    mkdir -p ${DB_FILENAME%/*}
    touch $DB_FILENAME
    node dist/index.js '"$args"'
  '
