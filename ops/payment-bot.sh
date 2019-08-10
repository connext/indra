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

project="indra_v2"
cwd="`pwd`"
args="$@"
identifier=1
while [ "$1" != "" ]; do
    case $1 in
        -i | --identifier )     shift
                                identifier=$1
                                ;;
    esac
    shift
done

DB_FILENAME="${DB_FILENAME:-.payment-bot-db/$identifier.json}"
ETH_RPC_URL="${ETH_RPC_URL:-http://172.17.0.1:8545}"
NODE_URL="${NODE_URL:-nats://172.17.0.1:4222}"

# Use different mnemonics for different bots
if [ "$identifier" = "1" ]; then
  export MNEMONIC="humble sense shrug young vehicle assault destroy cook property average silent travel"
else
  export MNEMONIC="roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult"
fi

test -t 0 -a -t 1 -a -t 2 && interactive="--tty"
my_id="`id -u`:`id -g`"

########################################
## Launch payment bot

echo
echo "Deploying payment bot..."

docker run \
  --entrypoint="bash" \
  --env="DB_FILENAME=$DB_FILENAME" \
  --env="ETH_RPC_URL=$ETH_RPC_URL" \
  --env="MNEMONIC=$MNEMONIC" \
  --env="NODE_URL=$NODE_URL" \
  $interactive \
  --name="${project}_payment_bot_$identifier" \
  --rm \
  --tty \
  --user="$my_id" \
  --volume="`pwd`:/root" \
  --workdir="/root" \
  ${project}_builder -c '
    set -e
    echo "payment bot container launched"
    cd modules/payment-bot
    mkdir -p ${DB_FILENAME%/*}
    touch $DB_FILENAME
    ts-node src/index.ts '"$args"'
  '
