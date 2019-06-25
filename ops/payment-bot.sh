#!/user/bin/env bash
set -e

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

########################################
## Setup env vars

project="indra_v2"
name=${project}_payment_bot_$1
cwd="`pwd`"

DELAY_SECONDS="2"
ETH_ADDRESSES="`cat address-book.json | tr -d ' \n\r'`"
# ETH_NETWORK="ganache" # "kovan"
ETH_NETWORK="kovan"
# ETH_RPC_URL="http://indra_v2_ethprovider:8545"
ETH_RPC_URL="https://kovan.infura.io/v3/52fbfcd6aab44b9db863600f7c24a6a0"
INTERMEDIARY_IDENTIFIER="xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6"
NATS_URL="nats://indra_v2_nats:4222"
NODE_URL="http://indra_v2_node:8080"
POSTGRES_DATABASE="$project"
POSTGRES_HOST="indra_v2_database"
POSTGRES_PASSWORD="$project"
POSTGRES_PORT="5432"
POSTGRES_USER="$project"
USERNAME="PaymentBot$1"

# different mnemonics for different bots
if [ "$1" = "1" ]; then
  export NODE_MNEMONIC="humble sense shrug young vehicle assault destroy cook property average silent travel"
else
  export NODE_MNEMONIC="roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult"
fi

args="$@"

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
  --env="DELAY_SECONDS=$DELAY_SECONDS" \
  --env="ETH_ADDRESSES=$ETH_ADDRESSES" \
  --env="ETH_NETWORK=$ETH_NETWORK" \
  --env="ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INTERMEDIARY_IDENTIFIER=$INTERMEDIARY_IDENTIFIER" \
  --env="NATS_URL=$NATS_URL" \
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
    node dist/index.js '"$args"'
  '
