#!/usr/bin/env bash
set -e

####################
# External Env Vars

# None used during dev-mode deployment

####################
# Internal Config

# meta config & hard-coded stuff you might want to change
number_of_services=8 # NOTE: Gotta update this manually when adding/removing services :(
watch_hub="no" # set to "yes" to live-redeploy hub when source code changes
watch_chainsaw="no" # set to "yes" to live-redeploy chainsaw when source code changes

# hard-coded config (you probably won't ever need to change these)
dashboard_url="dashboardd"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
eth_network="ganache"
eth_network_id="4447"
eth_rpc_url="http://ethprovider:8545"
log_level="20" # set to 10 for all logs or to 30 to only print warnings/errors
private_key="c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"
private_key_file="/run/secrets/hub_key_ganache"
project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"
service_user_key="foo"

# database connection settings
postgres_db="$project"
postgres_password_file="/run/secrets/${project}_database_dev"
postgres_url="database:5432"
postgres_user="$project"
redis_url="redis://redis:6379"

# docker images
chainsaw_image=${project}_builder
dashboard_image=${project}_builder
database_image=${project}_database:dev
ethprovider_image=${project}_builder
hub_image=${project}_builder
proxy_image=${project}_proxy:dev
redis_image=redis:5-alpine

# Address management
if [[ -f "address-book.json" ]] # prefer copy of address book in project root
then addressBook="address-book.json"
else addressBook="modules/contracts/ops/address-book.json"
fi
hub_wallet_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].hub`"
channel_manager_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].address`"
token_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].approvedToken`"

####################
# Deploy according to above configuration

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}
pull_if_unavailable $redis_image

# Initialize random new secrets
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
new_secret ${project}_database_dev
new_secret hub_key_ganache "$private_key"

# Deploy with an attachable network so tests & the daicard can connect to individual components
if [[ -z "`docker network ls -f name=$project | grep -w $project`" ]]
then
  id="`docker network create --attachable --driver overlay $project`"
  echo "Created ATTACHABLE network with id $id"
fi

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

networks:
  $project:
    external: true

secrets:
  ${project}_database_dev:
    external: true
  hub_key_ganache:
    external: true

volumes:
  chain_dev:
  database_dev:
  certs:

services:
  proxy:
    image: $proxy_image
    environment:
      DASHBOARD_URL: $dashboard_url
      ETH_RPC_URL: $eth_rpc_url
      MODE: dev
    networks:
      - $project
    ports:
      - "3000:80"
    volumes:
      - certs:/etc/letsencrypt

  dashboard_client:
    image: $dashboard_image
    entrypoint: npm start
    environment:
      NODE_ENV: development
    networks:
      - $project
    volumes:
      - `pwd`/modules/dashboard:/root

  dashboard:
    image: $dashboard_image
    entrypoint: nodemon server/server.js
    environment:
      NODE_ENV: development
      POSTGRES_DB: $postgres_db
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_USER: $postgres_user
      POSTGRES_URL: $postgres_url
    networks:
      - $project
    ports:
      - "9999:9999"
    secrets:
      - ${project}_database_dev
    volumes:
      - `pwd`/modules/dashboard:/root

  hub:
    image: $hub_image
    entrypoint: bash ops/dev.entry.sh hub $watch_hub
    environment:
      CHANNEL_MANAGER_ADDRESS: $channel_manager_address
      ETH_MNEMONIC: $eth_mnemonic
      ETH_NETWORK_ID: $eth_network_id
      ETH_RPC_URL: $eth_rpc_url
      HUB_WALLET_ADDRESS: $hub_wallet_address
      LOG_LEVEL: 20
      NODE_ENV: development
      POSTGRES_USER: $postgres_user
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_URL: $postgres_url
      POSTGRES_DB: $postgres_db
      PRIVATE_KEY_FILE: $private_key_file
      REDIS_URL: $redis_url
      SERVICE_USER_KEY: $service_user_key
      TOKEN_ADDRESS: $token_address
    networks:
      - $project
    ports:
      - "8080:8080"
    secrets:
      - ${project}_database_dev
      - hub_key_ganache
    volumes:
      - `pwd`/modules/hub:/root
      - `pwd`/modules/client:/client
      - `pwd`/modules/contracts/build/contracts:/contracts

  chainsaw:
    image: $chainsaw_image
    entrypoint: bash ops/dev.entry.sh chainsaw $watch_chainsaw
    environment:
      CHANNEL_MANAGER_ADDRESS: $channel_manager_address
      ETH_MNEMONIC: $eth_mnemonic
      ETH_NETWORK_ID: $eth_network_id
      ETH_RPC_URL: $eth_rpc_url
      HUB_WALLET_ADDRESS: $hub_wallet_address
      LOG_LEVEL: 20
      NODE_ENV: development
      POSTGRES_USER: $postgres_user
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_URL: $postgres_url
      POSTGRES_DB: $postgres_db
      PRIVATE_KEY_FILE: $private_key_file
      REDIS_URL: $redis_url
      SERVICE_USER_KEY: $service_user_key
      TOKEN_ADDRESS: $token_address
    networks:
      - $project
    secrets:
      - ${project}_database_dev
      - hub_key_ganache
    volumes:
      - `pwd`/modules/hub:/root
      - `pwd`/modules/client:/client
      - `pwd`/modules/contracts/build/contracts:/contracts

  ethprovider:
    image: $ethprovider_image
    entrypoint: bash ops/entry.sh signal
    environment:
      ETH_MNEMONIC: $eth_mnemonic
      ETH_NETWORK: $eth_network
      ETH_PROVIDER: $eth_rpc_url
    networks:
      - $project
    ports:
      - "8545:8545"
    volumes:
      - chain_dev:/data
      - `pwd`/modules/contracts:/root

  database:
    image: $database_image
    deploy:
      mode: global
    environment:
      ETH_NETWORK: $eth_network
      MODE: dev
      POSTGRES_USER: $project
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $postgres_password_file
    networks:
      - $project
    ports:
      - "5432:5432"
    secrets:
      - ${project}_database_dev
    volumes:
      - database_dev:/var/lib/postgresql/data
      - `pwd`/modules/database:/root

  redis:
    image: $redis_image
    networks:
      - $project
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
