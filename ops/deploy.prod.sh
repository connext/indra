#!/usr/bin/env bash
set -e

####################
# ENV VARS

project=connext
registry="connextproject"
number_of_services=5

# set defaults for some core env vars
MODE=$MODE; [[ -n "$MODE" ]] || MODE=development
DOMAINNAME=$DOMAINNAME; [[ -n "$DOMAINNAME" ]] || DOMAINNAME=localhost
EMAIL=$EMAIL; [[ -n "$EMAIL" ]] || EMAIL=noreply@gmail.com
INFURA_KEY=$INFURA_KEY; [[ -n "$INFURA_KEY" ]] || INFURA_KEY="abc123"

# misc settings
SERVICE_USER_KEY="foo"

# ethereum settings
ETH_RPC_URL="https://rinkeby.infura.io/jsonrpc/$INFURA_KEY"
WALLET_ADDRESS="0x742072C92D39c936fCAC59a6d5fA6Ad16b88b27e"
HOT_WALLET_ADDRESS="0x742072C92D39c936fCAC59a6d5fA6Ad16b88b27e"
CHANNEL_MANAGER_ADDRESS="0x8BA9df707565Ef788D0C72D41db8efbBADf41240" # see modules/contracts/ops/addresses.json
TOKEN_CONTRACT_ADDRESS="0xc778417e063141139fce010982780140aa0cd5ab" # Rinkeby WETH contract
PRIVATE_KEY_FILE="/run/secrets/private_key"

# database settings
REDIS_URL="redis://redis:6379"
POSTGRES_HOST="database"
POSTGRES_PORT="5432"
POSTGRES_USER="$project"
POSTGRES_DB="$project"
POSTGRES_PASSWORD_FILE="/run/secrets/connext_database"

####################
# Deploy according to above configuration

# Figure out which images we should use
if [[ "$DOMAINNAME" != "localhost" ]]
then
  if [[ "$MODE" == "live" ]]
  then version="`cat package.json | jq .version | tr -d '"'`"
  else version="latest"
  fi
  proxy_image="$registry/${project}_proxy:$version"
  database_image="$registry/${project}_database:$version"
  hub_image="$registry/${project}_hub:$version"
  redis_image="redis:5-alpine"
else
  proxy_image=${project}_proxy:latest
  database_image=${project}_database:latest
  hub_image=${project}_hub:latest
  redis_image=redis:5-alpine
fi

echo "Deploying images: $database_image and $hub_image and $proxy_image"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}

if [[ "$DOMAINNAME" != "localhost" ]]
then
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
  certs:

services:

  proxy:
    image: $proxy_image
    environment:
      DOMAINNAME: $DOMAINNAME
      EMAIL: $EMAIL
      ETH_RPC_URL: $ETH_RPC_URL
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt

  hub:
    image: $hub_image
    command: hub
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
      PRIVATE_KEY_FILE: $PRIVATE_KEY_FILE
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      ETH_RPC_URL: $ETH_RPC_URL
      WALLET_ADDRESS: $WALLET_ADDRESS
      HOT_WALLET_ADDRESS: $HOT_WALLET_ADDRESS
      CHANNEL_MANAGER_ADDRESS: $CHANNEL_MANAGER_ADDRESS
      TOKEN_CONTRACT_ADDRESS: $TOKEN_CONTRACT_ADDRESS
      POSTGRES_USER: $POSTGRES_USER
      POSTGRES_PASSWORD_FILE: $POSTGRES_PASSWORD_FILE
      POSTGRES_HOST: $POSTGRES_HOST
      POSTGRES_PORT: $POSTGRES_PORT
      POSTGRES_DB: $POSTGRES_DB
      REDIS_URL: $REDIS_URL

  chainsaw:
    image: $hub_image
    command: chainsaw
    depends_on:
      - postgres
    secrets:
      - connext_database
      - private_key
    environment:
      NODE_ENV: production
      POLLING_INTERVAL: 2000
      PRIVATE_KEY_FILE: $PRIVATE_KEY_FILE
      SERVICE_USER_KEY: $SERVICE_USER_KEY
      ETH_RPC_URL: $ETH_RPC_URL
      WALLET_ADDRESS: $WALLET_ADDRESS
      HOT_WALLET_ADDRESS: $HOT_WALLET_ADDRESS
      CHANNEL_MANAGER_ADDRESS: $CHANNEL_MANAGER_ADDRESS
      TOKEN_CONTRACT_ADDRESS: $TOKEN_CONTRACT_ADDRESS
      POSTGRES_USER: $POSTGRES_USER
      POSTGRES_PASSWORD_FILE: $POSTGRES_PASSWORD_FILE
      POSTGRES_HOST: $POSTGRES_HOST
      POSTGRES_PORT: $POSTGRES_PORT
      POSTGRES_DB: $POSTGRES_DB
      REDIS_URL: $REDIS_URL

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
      POSTGRES_PASSWORD_FILE: $POSTGRES_PASSWORD_FILE
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
