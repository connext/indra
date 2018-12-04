#!/usr/bin/env bash

####################
# ENV VARS

project=connext

# set defaults for some core env vars
MODE=$MODE; [[ -n "$MODE" ]] || MODE=development
DOMAINNAME=$DOMAINNAME; [[ -n "$DOMAINNAME" ]] || DOMAINNAME=localhost
EMAIL=$EMAIL; [[ -n "$EMAIL" ]] || EMAIL=noreply@gmail.com

# misc settings
SERVICE_USER_KEY="foo"

# ethereum settings
ETH_RPC_URL="http://ethprovider:8545"
ETH_NETWORK_ID="4447"
ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
WALLET_ADDRESS="0xfb482f8f779fd96a857f1486471524808b97452d"
CHANNEL_MANAGER_ADDRESS="0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42"
HOT_WALLET_ADDRESS="0xfb482f8f779fd96a857f1486471524808b97452d"
TOKEN_CONTRACT_ADDRESS="0xd01c08c7180eae392265d8c7df311cf5a93f1b73"

# database settings
POSTGRES_HOST="database"
POSTGRES_PORT="5432"
POSTGRES_USER="$project"
POSTGRES_DB="$project"
POSTGRES_PASSWORD_FILE="/run/secrets/database_dev"
REDIS_URL="redis://redis:6379"

# docker image settings
registry=docker.io
repository=connextproject

####################
# Deploy according to above configuration

if [[ "$MODE" == "live" ]]
then version="`cat package.json | jq .version | tr -d '"'`"
else version="latest"
fi

chainsaw_image="$registry/$repository/chainsaw:$version"
database_image="$registry/$repository/database:$version"
hub_image="$registry/$repository/hub:$version"
redis_image="redis:5-alpine"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null

function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}

pull_if_unavailable $chainsaw_image
pull_if_unavailable $database_image
pull_if_unavailable $hub_image
pull_if_unavailable $redis_image

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

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  connext_database:
    external: true

volumes:
  database:

services:

  hub:
    image: $hub_image
    ports:
      - '3000:3000'
    depends_on:
      - database
      - chainsaw
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

  chainsaw:
    image: $chainsaw_image
    ports:
      - '3001:3001'
    depends_on:
      - postgres
    secrets:
      - connext_db_dev
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
    ports:
      - "6379:6379"

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
    if [[ "$num_awake" == "4" ]]
    then break
    else echo -n "."
    fi
done
echo " Good Morning!"
sleep 2
