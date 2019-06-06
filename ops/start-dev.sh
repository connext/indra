#!/usr/bin/env bash
set -e

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

####################
# External Env Vars

# None used during dev-mode deployment

####################
# Internal Config

# meta config & hard-coded stuff you might want to change
number_of_services=8 # NOTE: Gotta update this manually when adding/removing services :(

# hard-coded config (you probably won't ever need to change these)
dashboard_url="dashboardd"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
eth_network="ganache"
eth_network_id="4447"
eth_rpc_url="http://ethprovider:8545"
log_level="3" # set to 0 for no logs or to 50 for all the logs
private_key="c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"
private_key_file="/run/secrets/hub_key_ganache"
project="indra"
service_key="foo"
hub_port=8080
hub_ws_port=8081

# database connection settings
postgres_db="$project"
postgres_password_file="/run/secrets/${project}_database_dev"
postgres_url="database:5432"
postgres_user="$project"
redis_url="redis://redis:6379"

# docker images
builder_image=${project}_builder
chainsaw_image=$builder_image
dashboard_image=$builder_image
dashboard_server_image=$builder_image
database_image=${project}_database:dev
ethprovider_image=$builder_image
hub_image=$builder_image
proxy_image=${project}_proxy:dev
redis_image=redis:5-alpine

# Address management
if [[ -f "address-book.json" ]] # prefer copy of address book in project root
then addressBook="address-book.json"
else addressBook="modules/contracts/ops/address-book.json"
fi
hot_wallet_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].hub`"
channel_manager_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].address`"
token_contract_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].approvedToken`"

####################
# Deploy according to above configuration

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

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

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
    ports:
      - "3000:80"
    volumes:
      - certs:/etc/letsencrypt

  dashboard_client:
    image: $dashboard_image
    entrypoint: npm start
    environment:
      NODE_ENV: development
    volumes:
      - `pwd`/modules/dashboard:/root

  dashboard:
    image: $dashboard_server_image
    entrypoint: nodemon --legacy-watch src/server.js
    environment:
      NODE_ENV: development
      POSTGRES_DB: $postgres_db
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_USER: $postgres_user
      POSTGRES_URL: $postgres_url
    ports:
      - "9999:9999"
    secrets:
      - ${project}_database_dev
    volumes:
      - `pwd`/modules/dashboard-server:/root

  hub:
    image: $hub_image
    entrypoint: bash ops/entry.sh hub
    environment:
      CHANNEL_MANAGER_ADDRESS: $channel_manager_address
      ETH_MNEMONIC: $eth_mnemonic
      ETH_NETWORK_ID: $eth_network_id
      ETH_RPC_URL: $eth_rpc_url
      HOT_WALLET_ADDRESS: $hot_wallet_address
      LOG_LEVEL: $log_level
      NODE_ENV: development
      PORT: $hub_port
      POSTGRES_USER: $postgres_user
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_URL: $postgres_url
      POSTGRES_DB: $postgres_db
      PRIVATE_KEY_FILE: $private_key_file
      REDIS_URL: $redis_url
      SERVICE_KEY: $service_key
      TOKEN_CONTRACT_ADDRESS: $token_contract_address
      WEBSOCKET_PORT: $hub_ws_port
    ports:
      - "$hub_port:$hub_port"
      - "$hub_ws_port:$hub_ws_port"
    secrets:
      - ${project}_database_dev
      - hub_key_ganache
    volumes:
      - `pwd`/modules/hub:/root
      - `pwd`/modules/client:/client
      - `pwd`/modules/contracts/build/contracts:/contracts

  chainsaw:
    image: $chainsaw_image
    entrypoint: bash ops/entry.sh chainsaw
    environment:
      CHANNEL_MANAGER_ADDRESS: $channel_manager_address
      ETH_MNEMONIC: $eth_mnemonic
      ETH_NETWORK_ID: $eth_network_id
      ETH_RPC_URL: $eth_rpc_url
      HOT_WALLET_ADDRESS: $hot_wallet_address
      LOG_LEVEL: $log_level
      NODE_ENV: development
      POSTGRES_USER: $postgres_user
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_URL: $postgres_url
      POSTGRES_DB: $postgres_db
      PRIVATE_KEY_FILE: $private_key_file
      REDIS_URL: $redis_url
      SERVICE_KEY: $service_key
      TOKEN_CONTRACT_ADDRESS: $token_contract_address
    secrets:
      - ${project}_database_dev
      - hub_key_ganache
    volumes:
      - `pwd`/modules/hub:/root
      - `pwd`/modules/client:/client
      - `pwd`/modules/contracts/build/contracts:/contracts

  ethprovider:
    image: $ethprovider_image
    entrypoint: bash ops/entry.sh
    environment:
      ETH_MNEMONIC: $eth_mnemonic
      ETH_NETWORK: $eth_network
      ETH_PROVIDER: $eth_rpc_url
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
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_USER: $project
    ports:
      - "5432:5432"
    secrets:
      - ${project}_database_dev
    volumes:
      - database_dev:/var/lib/postgresql/data
      - `pwd`/modules/database:/root

  redis:
    image: $redis_image
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
