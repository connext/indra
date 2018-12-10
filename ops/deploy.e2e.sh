#!/usr/bin/env bash
set -e

####################
# ENV VARS

DOMAINNAME=localhost
ETH_NETWORK_ID="4447"
ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
WALLET_ADDRESS="0xfb482f8f779fd96a857f1486471524808b97452d"
CHANNEL_MANAGER_ADDRESS="0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42"
HOT_WALLET_ADDRESS="0xfb482f8f779fd96a857f1486471524808b97452d"
TOKEN_CONTRACT_ADDRESS="0xd01c08c7180eae392265d8c7df311cf5a93f1b73"
SERVICE_USER_KEY="foo"
ETH_RPC_URL="http://ethprovider:8545"
REDIS_URL="redis://redis:6379"

####################

project=connext
test_image=${project}_test:dev
ethprovider_image=${project}_ethprovider:dev
database_image=${project}_database:dev
hub_image=${project}_hub:dev
redis_image=redis:5-alpine

docker swarm init 2> /dev/null || true

function pull_if_unavailable {
    if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
    then
        docker pull $1
    fi
}

pull_if_unavailable $redis_image

function new_secret {
    secret=$2
    if [[ -z "$secret" ]]
    then
        secret=`head -c 32 /dev/urandom | xxd -plain -c 32 | tr -d '\n\r'`
    fi
    if [[ -z "`docker secret ls -f name=$1 | grep -w $1`" ]]
    then
        id=`echo $secret | tr -d '\n\r' | docker secret create $1 -`
        echo "Created secret called $1 with id $id"
    fi
}

new_secret database_test

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.6'

secrets:
  database_test:
    external: true

services:
  
  test:
    image: $test_image
    secrets:
      - database_test
    environment:
      POSTGRES_USER: $project
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: /run/secrets/database_test
      REDIS_URL: $REDIS_URL
    deploy:
      restart_policy:
        condition: none

  hub:
    image: $hub_image
    ports:
      - "8080:8080"
    secrets:
      - database_test
    environment:
      WALLET_ADDRESS: $WALLET_ADDRESS
      CHANNEL_MANAGER_ADDRESS: $CHANNEL_MANAGER_ADDRESS
      HOT_WALLET_ADDRESS: $HOT_WALLET_ADDRESS
      TOKEN_CONTRACT_ADDRESS: $TOKEN_CONTRACT_ADDRESS
      ETH_RPC_URL: $ETH_RPC_URL
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      POSTGRES_USER: $project
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: /run/secrets/database_test
      REDIS_URL: $REDIS_URL

  redis:
    image: $redis_image
    ports:
      - "6379:6379"

  database:
    image: $database_image
    environment:
      POSTGRES_USER: $project
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: /run/secrets/database_test
    deploy:
      mode: global
    ports:
      - "5432:5432"
    secrets:
      - database_test
    volumes:
      - type: tmpfs
        target: /var/lib/postgresql/data 

  ethprovider:
    image: $ethprovider_image
    environment:
      ETH_NETWORK_ID: $ETH_NETWORK_ID
      ETH_MNEMONIC: $ETH_MNEMONIC
    ports:
      - "8545:8545"
    volumes:
      - type: tmpfs
        target: /data
      - `pwd`/modules/contracts/contracts:/app/contracts
      - `pwd`/modules/contracts/migrations:/app/migrations
      - `pwd`/modules/contracts/build:/app/build
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml ${project}_test
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
while true
do num_awake="`docker container ls | grep $project | wc -l | sed 's/ //g'`"
   sleep 3
   if [[ "$num_awake" == "5" ]]
   then break
   else echo -n "."
   fi
done
echo " Good Morning!"
sleep 2
