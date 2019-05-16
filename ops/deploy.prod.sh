#!/usr/bin/env bash
set -e

####################
# External Env Vars

# Config
INDRA_DOMAINNAME="${INDRA_DOMAINNAME:-localhost}"
INDRA_EMAIL="${INDRA_EMAIL:-noreply@gmail.com}" # for notifications when ssl certs expire
INDRA_ETH_NETWORK="${INDRA_ETH_NETWORK:-rinkeby}"
INDRA_MODE="${INDRA_MODE:-staging}" # set to "live" to use versioned docker images

# Auth & API Keys
INDRA_AWS_ACCESS_KEY_ID="${INDRA_AWS_ACCESS_KEY_ID:-}"
INDRA_AWS_SECRET_ACCESS_KEY="${INDRA_AWS_SECRET_ACCESS_KEY:-}"
INDRA_DASHBOARD_URL="${INDRA_DASHBOARD_URL:-dashboarddd}"
INDRA_ETH_RPC_KEY_MAINNET="${INDRA_ETH_RPC_KEY_MAINNET:-qHg6U3i7dKa4cJdMagOljenupIraBE1V}"
INDRA_ETH_RPC_KEY_RINKEBY="${INDRA_ETH_RPC_KEY_RINKEBY:-RvyVeludt7uwmt2JEF2a1PvHhJd5c07b}"
INDRA_LOGDNA_KEY="${INDRA_LOGDNA_KEY:-abc123}"
INDRA_SERVICE_USER_KEY="${INDRA_SERVICE_USER_KEY:-foo}"

####################
# Internal Config

# meta config & hard-coded stuff you might want to change
number_of_services=7 # NOTE: Gotta update this manually when adding/removing services :(
should_collateralize_url="NO_CHECK"
bei_min_collateralization="10000000000000000000"
channel_bei_limit=${CHANNEL_BEI_LIMIT}
channel_bei_deposit=${CHANNEL_BEI_DEPOSIT}

# hard-coded config (you probably won't ever need to change these)
log_level="20" # set to 10 for all logs or to 30 to only print warnings/errors
private_key_name="hub_key_$INDRA_ETH_NETWORK"
private_key_file="/run/secrets/$private_key_name"

# Docker image settings
registry="connextproject"
project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"

# database connection settings
postgres_db="$project"
postgres_password_file="/run/secrets/${project}_database"
postgres_url="database:5432"
postgres_user="$project"
redis_url="redis://redis:6379"

# ethereum settings
# Allow contract address overrides if an address book is present in project root
if [[ -f "address-book.json" ]]
then addressBook="address-book.json"
else addressBook="modules/contracts/ops/address-book.json"
fi

if [[ "$INDRA_ETH_NETWORK" == "mainnet" ]]
then 
  eth_network_id="1"
  eth_rpc_url="https://eth-mainnet.alchemyapi.io/jsonrpc/$INDRA_ETH_RPC_KEY_MAINNET"
elif [[ "$INDRA_ETH_NETWORK" == "rinkeby" ]]
then 
  eth_network_id="4"
  eth_rpc_url="https://eth-rinkeby.alchemyapi.io/jsonrpc/$INDRA_ETH_RPC_KEY_RINKEBY"
else echo "Network $INDRA_ETH_NETWORK not supported for prod-mode deployments" && exit 1
fi

hub_wallet_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].hub`"
channel_manager_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].address`"
token_address="`cat $addressBook | jq .ChannelManager.networks[\\"$eth_network_id\\"].approvedToken`"

# Figure out which images we should use
if [[ "$INDRA_DOMAINNAME" != "localhost" ]]
then
  if [[ "$INDRA_MODE" == "live" ]]
  then version="`cat package.json | jq .version | tr -d '"'`"
  else version="latest" # staging mode
  fi
  proxy_image="$registry/${project}_proxy:$version"
  dashboard_image="$registry/${project}_dashboard:$version"
  database_image="$registry/${project}_database:$version"
  hub_image="$registry/${project}_hub:$version"
  redis_image="redis:5-alpine"
else # local mode, don't use images from registry
  proxy_image=${project}_proxy:latest
  dashboard_image=${project}_dashboard:latest
  database_image=${project}_database:latest
  hub_image=${project}_hub:latest
  redis_image=redis:5-alpine
fi

####################
# Deploy according to above configuration

echo "Deploying images: $database_image & $hub_image & $proxy_image to $INDRA_DOMAINNAME"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then
    # But actually don't pull images if we're running locally
    if [[ "$INDRA_DOMAINNAME" != "localhost" ]]
    then docker pull $1
    fi
  fi
}
pull_if_unavailable $dashboard_image
pull_if_unavailable $database_image
pull_if_unavailable $hub_image
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
new_secret ${project}_database
new_secret $private_key_name

mkdir -p /tmp/$project modules/database/snapshots
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  ${project}_database:
    external: true
  $private_key_name:
    external: true

volumes:
  ${project}_database:
    external: true
  certs:

services:
  proxy:
    image: $proxy_image
    environment:
      DASHBOARD_URL: $INDRA_DASHBOARD_URL
      DOMAINNAME: $INDRA_DOMAINNAME
      EMAIL: $INDRAS_EMAIL
      ETH_RPC_URL: $eth_rpc_url
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt

  dashboard:
    image: $dashboard_image
    environment:
      POSTGRES_DB: $postgres_db
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_URL: $postgres_url
      POSTGRES_USER: $postgres_user
    secrets:
      - ${project}_database

  hub:
    image: $hub_image
    command: hub
    depends_on:
      - database
      - chainsaw
    environment:
      CHANNEL_BEI_LIMIT: $channel_bei_limit
      CHANNEL_BEI_DEPOSIT: $channel_bei_deposit
      CHANNEL_MANAGER_ADDRESS: $channel_manager_address
      ETH_NETWORK_ID: $eth_network_id
      ETH_RPC_URL: $eth_rpc_url
      HUB_WALLET_ADDRESS: $hub_wallet_address
      LOG_LEVEL: 20
      NODE_ENV: production
      POSTGRES_DB: $postgres_db
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_URL: $postgres_url
      POSTGRES_USER: $postgres_user
      PRIVATE_KEY_FILE: $private_key_file
      REDIS_URL: $redis_url
      SERVICE_USER_KEY: $INDRA_SERVICE_USER_KEY
      SHOULD_COLLATERALIZE_URL: $should_collateralize_url
      TOKEN_ADDRESS: $token_address
      BEI_MIN_COLLATERALIZATION: $bei_min_collateralization
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    secrets:
      - ${project}_database
      - $private_key_name

  chainsaw:
    image: $hub_image
    command: chainsaw
    depends_on:
      - postgres
    environment:
      CHANNEL_BEI_LIMIT: $channel_bei_limit
      CHANNEL_BEI_DEPOSIT: $channel_bei_deposit
      CHANNEL_MANAGER_ADDRESS: $channel_manager_address
      ETH_NETWORK_ID: $eth_network_id
      ETH_RPC_URL: $eth_rpc_url
      HUB_WALLET_ADDRESS: $hub_wallet_address
      LOG_LEVEL: 20
      NODE_ENV: production
      POLLING_INTERVAL: 2000
      POSTGRES_DB: $postgres_db
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_URL: $postgres_url
      POSTGRES_USER: $postgres_user
      PRIVATE_KEY_FILE: $private_key_file
      REDIS_URL: $redis_url
      SERVICE_USER_KEY: $INDRA_SERVICE_USER_KEY
      SHOULD_COLLATERALIZE_URL: $should_collateralize_url
      TOKEN_ADDRESS: $token_address
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    secrets:
      - ${project}_database
      - $private_key_name

  redis:
    image: $redis_image

  database:
    image: $database_image
    deploy:
      mode: global
    secrets:
      - ${project}_database
    environment:
      AWS_ACCESS_KEY_ID: $INDRA_AWS_ACCESS_KEY_ID
      AWS_SECRET_ACCESS_KEY: $INDRA_AWS_SECRET_ACCESS_KEY
      ETH_NETWORK: $INDRA_ETH_NETWORK
      POSTGRES_DB: $postgres_db
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_USER: $postgres_user
    volumes:
      - ${project}_database:/var/lib/postgresql/data
      - `pwd`/modules/database/snapshots:/root/snapshots

  logdna:
    image: logdna/logspout:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      LOGDNA_KEY: $INDRA_LOGDNA_KEY
      TAGS: logdna
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project
docker image prune -f

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
