#!/usr/bin/env bash

####################
# ENV VARS

DOMAINNAME=localhost
ETH_PROVIDER="http://ethprovider:8545"
ETH_NETWORK_ID="4447"
ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

####################

project=connext
ethprovider_image=${project}_ethprovider:dev
database_image=postgres:9-alpine
redis_image=redis:5-alpine

docker swarm init 2> /dev/null

function pull_if_unavailable {
    if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
    then
        docker pull $1
    fi
}

pull_if_unavailable $database_image
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

new_secret database_dev

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  database_dev:
    external: true

volumes:
  chain_dev:
  database_dev:

services:

  database:
    image: $database_image
    environment:
      POSTGRES_USER: $project
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: /run/secrets/database_dev
    deploy:
      mode: global
    secrets:
      - database_dev
    volumes:
      - database_dev:/var/lib/postgresql/data

  ethprovider:
    image: $ethprovider_image
    environment:
      ETH_NETWORK_ID: $ETH_NETWORK_ID
      ETH_MNEMONIC: $ETH_MNEMONIC
    ports:
      - "8545:8545"
    volumes:
      - chain_dev:/data
      - `pwd`/modules/contracts/contracts:/app/contracts
      - `pwd`/modules/contracts/migrations:/app/migrations
      - `pwd`/modules/contracts/build:/app/build
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
while true
do num_awake="`docker container ls | grep $project | wc -l | sed 's/ //g'`"
   sleep 3
   if [[ "$num_awake" == "2" ]]
   then break
   else echo -n "."
   fi
done
echo " Good Morning!"
sleep 2
