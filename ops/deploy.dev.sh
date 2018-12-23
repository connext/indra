#!/usr/bin/env bash
set -e

####################
# ENV VARS

project=connext
number_of_services=7
proxy_image=${project}_proxy:dev
wallet_image=${project}_wallet:dev
hub_image=${project}_hub:dev
chainsaw_image=${project}_hub:dev
redis_image=redis:5-alpine
database_image=${project}_database:dev
ethprovider_image=${project}_ethprovider:dev

# set defaults for some core env vars
MODE=$MODE; [[ -n "$MODE" ]] || MODE=development
DOMAINNAME=$DOMAINNAME; [[ -n "$DOMAINNAME" ]] || DOMAINNAME=localhost
EMAIL=$EMAIL; [[ -n "$EMAIL" ]] || EMAIL=noreply@gmail.com

# ethereum settings
ETH_RPC_URL="http://ethprovider:8545"
ETH_NETWORK_ID="4447"
ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

# database settings
REDIS_URL="redis://redis:6379"
POSTGRES_HOST="database"
POSTGRES_PORT="5432"
POSTGRES_USER="$project"
POSTGRES_DB="$project"
POSTGRES_PASSWORD_FILE="/run/secrets/connext_database_dev"

# set any of these to "watch" to turn on watchers
watch_ethprovider="no"
watch_hub="no"
watch_chainsaw="no"

####################
# Deploy according to above configuration

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}

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

new_secret connext_database_dev

if [[ -z "`docker network ls -f name=$project | grep -w $project`" ]]
then
    id=`docker network create --attachable --driver overlay $project`
    echo "Created ATTACHABLE network with id $id"
fi

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

networks:
  $project:
    external: true

secrets:
  connext_database_dev:
    external: true

volumes:
  chain_dev:
  database_dev:
  certs:

services:

  proxy:
    image: $proxy_image
    networks:
      - $project
    ports:
      - "80:80"
    volumes:
      - certs:/etc/letsencrypt

  wallet:
    image: $wallet_image
    networks:
      - $project
    environment:
      NODE_ENV: $MODE
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      ETH_MNEMONIC: $ETH_MNEMONIC
      ETHPROVIDER_URL: "http://localhost:8545"
      HUB_URL: "http://localhost/hub"
    ports:
      - "3000:3000"
    volumes:
      - `pwd`/modules/wallet:/root
      - `pwd`/modules/client:/client
      - `pwd`/modules/contracts/build/contracts:/contracts

  hub:
    image: $hub_image
    command: hub $watch_hub
    networks:
      - $project
    ports:
      - "8080:8080"
    secrets:
      - connext_database_dev
    environment:
      NODE_ENV: $MODE
      ETH_MNEMONIC: $ETH_MNEMONIC
      ETH_RPC_URL: $ETH_RPC_URL
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      POSTGRES_USER: $POSTGRES_USER
      POSTGRES_PASSWORD_FILE: $POSTGRES_PASSWORD_FILE
      POSTGRES_HOST: $POSTGRES_HOST
      POSTGRES_PORT: $POSTGRES_PORT
      POSTGRES_DB: $POSTGRES_DB
      REDIS_URL: $REDIS_URL
    volumes:
      - `pwd`/modules/hub:/root
      - `pwd`/modules/client:/client
      - `pwd`/modules/contracts/build/contracts:/contracts

  chainsaw:
    image: $chainsaw_image
    command: chainsaw $watch_chainsaw
    networks:
      - $project
    secrets:
      - connext_database_dev
    environment:
      NODE_ENV: $MODE
      ETH_MNEMONIC: $ETH_MNEMONIC
      ETH_RPC_URL: $ETH_RPC_URL
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      POSTGRES_USER: $POSTGRES_USER
      POSTGRES_PASSWORD_FILE: $POSTGRES_PASSWORD_FILE
      POSTGRES_HOST: $POSTGRES_HOST
      POSTGRES_PORT: $POSTGRES_PORT
      POSTGRES_DB: $POSTGRES_DB
      REDIS_URL: $REDIS_URL
    volumes:
      - `pwd`/modules/hub:/root
      - `pwd`/modules/client:/client
      - `pwd`/modules/contracts/build/contracts:/contracts

  ethprovider:
    image: $ethprovider_image
    command: $watch_ethprovider
    environment:
      ETH_NETWORK_ID: $ETH_NETWORK_ID
      ETH_MNEMONIC: $ETH_MNEMONIC
    networks:
      - $project
    ports:
      - "8545:8545"
    volumes:
      - chain_dev:/data
      - `pwd`/modules/contracts:/root

  database:
    image: $database_image
    environment:
      POSTGRES_USER: $project
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $POSTGRES_PASSWORD_FILE
    deploy:
      mode: global
    networks:
      - $project
    ports:
      - "5432:5432"
      - "5433:5433"
    secrets:
      - connext_database_dev
    volumes:
      - database_dev:/var/lib/postgresql/data

  redis:
    image: $redis_image
    networks:
      - $project
    ports:
      - "6379:6379"
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
