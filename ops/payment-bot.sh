#!/user/bin/env bash
set -e

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

########################################
## Setup env vars

project="indra_v2"
name=${project}_payment_bot
cwd="`pwd`"

export BASE_URL="http://indra_v2_node:8080"
export DELAY_SECONDS="2"
export ETHEREUM_NETWORK="ganache"
export INTERMEDIARY_IDENTIFIER="xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6"
export NODE_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
export NODE_URL="nats://indra_v2_nats:4222"
export POSTGRES_DATABASE="$project"
export POSTGRES_HOST="indra_v2_database"
export POSTGRES_PASSWORD="$project"
export POSTGRES_PORT="5432"
export POSTGRES_USER="$project"
export PRIVATE_KEY="0x91cce879403351edf573d7eb09f309377662ae9a7c973692d22fd7e931673a73"
export USERNAME="PaymentBot1"

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
  --env="BASE_URL=$BASE_URL" \
  --env="DELAY_SECONDS=$DELAY_SECONDS" \
  --env="ETHEREUM_NETWORK=$ETHEREUM_NETWORK" \
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
    node dist/index.js '"$args"'
  '
