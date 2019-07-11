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

########################################
## Setup env vars

project="indra_v2"
cwd="`pwd`"

INTERMEDIARY_IDENTIFIER="xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6"
NODE_URL="nats://indra_v2_nats:4222"
POSTGRES_DATABASE="$project"
POSTGRES_HOST="indra_v2_database"
POSTGRES_PASSWORD="$project"
POSTGRES_PORT="5432"
POSTGRES_USER="$project"

# Set the eth rpc url to use the same network as the node server is using
ETH_RPC_URL="http://indra_v2_ethprovider:8545"
ethNetwork="`curl -s localhost:8080/config | jq .ethNetwork.name | tr -d '"'`"
if [[ "$ethNetwork" != "ganache" ]]
then ETH_RPC_URL="https://$ethNetwork.infura.io/metamask"
fi

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

USERNAME="PaymentBot$identifier"
name=${project}_payment_bot_$identifier

# Use different mnemonics for different bots
if [ "$identifier" = "1" ]; then
  export NODE_MNEMONIC="humble sense shrug young vehicle assault destroy cook property average silent travel"
else
  export NODE_MNEMONIC="roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult"
fi

echo $args
########################################
## Build everything that we need

make

########################################
## Launch payment bot

# Create attachable network if it doesn't already exist
docker network create --attachable $project 2> /dev/null || true

echo
echo "Deploying payment bot..."

docker run \
  --entrypoint="bash" \
  --env="ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INTERMEDIARY_IDENTIFIER=$INTERMEDIARY_IDENTIFIER" \
  --env="NODE_MNEMONIC=$NODE_MNEMONIC" \
  --env="NODE_URL=$NODE_URL" \
  --env="POSTGRES_DATABASE=$POSTGRES_DATABASE" \
  --env="POSTGRES_HOST=$POSTGRES_HOST" \
  --env="POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
  --env="POSTGRES_PORT=$POSTGRES_PORT" \
  --env="POSTGRES_USER=$POSTGRES_USER" \
  --env="PRIVATE_KEY=$PRIVATE_KEY" \
  --env="USERNAME=$USERNAME" \
  --interactive \
  --name="$name" \
  --network="$project" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  --workdir="/root" \
  ${project}_builder -c '
    echo "payment bot container launched"
    cd modules/payment-bot
    ts-node src/index.ts '"$args"'
  '
