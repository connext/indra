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

# Damn I forget where I copy/pasted this witchcraft from, yikes.
# It's supposed to find out whether we're calling this script from a shell & can print stuff
# Or whether it's running in the background of another script and can't attach to a screen
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

mkdir -p modules/payment-bot/.payment-bot-db

########################################
## Launch payment bot

docker run \
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
  --volume="$cwd/modules/payment-bot/.payment-bot-db:/root/modules/payment-bot/.payment-bot-db" \
  ${project}_bot "`id -u`:`id -g`" $args
