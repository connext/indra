#!/usr/bin/env bash
set -e

####################
# ENV VARS

project=connext
number_of_services=4

# set defaults for some core env vars
MODE=$MODE; [[ -n "$MODE" ]] || MODE=development
DOMAINNAME=$DOMAINNAME; [[ -n "$DOMAINNAME" ]] || DOMAINNAME=localhost
EMAIL=$EMAIL; [[ -n "$EMAIL" ]] || EMAIL=noreply@gmail.com
INFURA_KEY="RNXFMnEXo6TEeIYzcTyQ" # provided by bohendo

# docker image settings
repository="`whoami`"
registry=docker.io

# misc settings
SERVICE_USER_KEY="foo"

# ethereum settings
ETH_RPC_URL="https://ropsten.infura.io/$INFURA_KEY:8545"
WALLET_ADDRESS="0xB669b484f2c72D226463d9c75d9B9A871aE7904e"
HOT_WALLET_ADDRESS="0xB669b484f2c72D226463d9c75d9B9A871aE7904e"
CHANNEL_MANAGER_ADDRESS="0xD6EA218b3F5FEb69A2674EFee592B1c7A589E268" # see modules/contracts/ops/addresses.json
TOKEN_CONTRACT_ADDRESS="0xc778417E063141139Fce010982780140Aa0cD5Ab" # Ropsten WETH contract

# database settings
POSTGRES_HOST="database"
POSTGRES_PORT="5432"
POSTGRES_USER="$project"
POSTGRES_DB="$project"
POSTGRES_PASSWORD_FILE="/run/secrets/database_dev"
REDIS_URL="redis://redis:6379"

####################
# Deploy according to above configuration

if [[ "$MODE" == "live" ]]
then version="`cat package.json | jq .version | tr -d '"'`"
else version="latest"
fi

chainsaw_image="$registry/$repository/${project}_chainsaw:$version"
database_image="$registry/$repository/${project}_database:$version"
hub_image="$registry/$repository/${project}_hub:$version"
redis_image="redis:5-alpine"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}

if [[ "$DOMAINNAME" != "localhost" ]]
then
  pull_if_unavailable $chainsaw_image
  pull_if_unavailable $database_image
  pull_if_unavailable $hub_image
  pull_if_unavailable $redis_image
fi

function new_secret {
  secret=$2
  if [[ -z "$secret" ]]
  then secret=`head -c 32 /dev/urandom | xxd -plain -c 32 | tr -d '\n\r'`
  fi
  if [[ -z "`docker secret ls -f name=$1 | grep -w $1`" ]]
  then
    id=`echo $secret | tr -d '\n\r' | docker secret create $1 -`
    echo "Created secret called $1 with id $id"
  fi
}

new_secret connext_database
new_secret private_key $PRIVATE_KEY

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  connext_database:
    external: true
  private_key:
    external: true

volumes:
  database:

services:

  hub:
    image: $hub_image
    ports:
      - '3000:8080'
    depends_on:
      - database
      - chainsaw
    secrets:
      - connext_database
      - private_key
    environment:
      NODE_ENV: production
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      ETH_RPC_URL: $ETH_RPC_URL
      WALLET_ADDRESS: $WALLET_ADDRESS
      HOT_WALLET_ADDRESS: $HOT_WALLET_ADDRESS
      CHANNEL_MANAGER_ADDRESS: $CHANNEL_MANAGER_ADDRESS
      TOKEN_CONTRACT_ADDRESS: $TOKEN_CONTRACT_ADDRESS
      POSTGRES_USER: $POSTGRES_USER
      POSTGRES_PASSWORD_FILE: /run/secrets/connext_database
      POSTGRES_HOST: $POSTGRES_HOST
      POSTGRES_PORT: $POSTGRES_PORT
      POSTGRES_DB: $POSTGRES_DB
      REDIS_URL: $REDIS_URL

  chainsaw:
    image: $chainsaw_image
    depends_on:
      - postgres
    secrets:
      - connext_database
    environment:
      NODE_ENV: production
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      ETH_RPC_URL: $ETH_RPC_URL
      WALLET_ADDRESS: $WALLET_ADDRESS
      HOT_WALLET_ADDRESS: $HOT_WALLET_ADDRESS
      CHANNEL_MANAGER_ADDRESS: $CHANNEL_MANAGER_ADDRESS
      TOKEN_CONTRACT_ADDRESS: $TOKEN_CONTRACT_ADDRESS
      POSTGRES_USER: $POSTGRES_USER
      POSTGRES_PASSWORD_FILE: /run/secrets/connext_database
      POSTGRES_HOST: $POSTGRES_HOST
      POSTGRES_PORT: $POSTGRES_PORT
      POSTGRES_DB: $POSTGRES_DB
      REDIS_URL: $REDIS_URL
      POLLING_INTERVAL: 2000

  redis:
    image: $redis_image

  database:
    image: $database_image
    deploy:
      mode: global
    secrets:
      - connext_database
    environment:
      POSTGRES_USER: $POSTGRES_USER
      POSTGRES_DB: $POSTGRES_DB
      POSTGRES_PASSWORD_FILE: /run/secrets/connext_database
    volumes:
      - database:/var/lib/postgresql/data
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
while true
do
    num_awake="`docker container ls | grep $project | wc -l | sed 's/ //g'`"
    sleep 3
    if [[ "$num_awake" == "$number_of_services" ]]
    then break
    else echo -n "."
    fi
done
echo " Good Morning!"
sleep 3
