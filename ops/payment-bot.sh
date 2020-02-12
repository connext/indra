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

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

mode="${TEST_MODE:-local}"
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

name="${project}_bot"
commit="`git rev-parse HEAD | head -c 8`"
release="`cat package.json | grep '"version":' | awk -F '"' '{print $4}'`"

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

if [[ "$mode" == "local" ]]
then

  echo "Launching local bot"

  exec docker run \
    $interactive \
    --entrypoint="bash" \
    --env="ECCRYPTO_NO_FALLBACK=true" \
    --env="ETH_RPC_URL=$ETH_RPC_URL" \
    --env="MNEMONIC=$mnemonic" \
    --env="NODE_URL=$NODE_URL" \
    --env="WEBDIS_URL=$WEBDIS_URL" \
    --env="PISA_URL=$PISA_URL" \
    --env="PISA_CONTRACT_ADDRESS=$PISA_CONTRACT_ADDRESS" \
    --name="${project}_payment_bot_$identifier" \
    --rm \
    --volume="$cwd/.bot-store:/store" \
    --volume="$cwd:/root" \
    ${project}_builder -c "cd modules/payment-bot && bash ops/entry.sh `id -u`:`id -g` $args"

elif [[ "$mode" == "release" ]]
then image=$name:$release;
elif [[ "$mode" == "staging" ]]
then image=$name:$commit;
else image=$name:latest;
fi

########################################
## Launch payment bot

exec docker run \
  --env="ETH_RPC_URL=$ETH_RPC_URL" \
  --env="MNEMONIC=$mnemonic" \
  --env="NODE_URL=$NODE_URL" \
  --env="WEBDIS_URL=$WEBDIS_URL" \
  --env="PISA_URL=$PISA_URL" \
  --env="PISA_CONTRACT_ADDRESS=$PISA_CONTRACT_ADDRESS" \
  $interactive \
  --name="${project}_payment_bot_$identifier" \
  --rm \
  --volume="$cwd/.bot-store:/store" \
  $image "`id -u`:`id -g`" $args
