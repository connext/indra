#!/usr/bin/env bash
set -e

project="indra_v2"
registry="connextproject"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

####################
# External Env Vars

# Config
INDRA_V2_DOMAINNAME="${INDRA_V2_DOMAINNAME:-localhost}"
INDRA_V2_EMAIL="${INDRA_V2_EMAIL:-noreply@gmail.com}" # for notifications when ssl certs expire
INDRA_V2_ETH_NETWORK="${INDRA_V2_ETH_NETWORK:-kovan}"
INDRA_V2_MODE="${INDRA_V2_MODE:-staging}" # set to "live" to use versioned docker images

# Auth & API Keys
INDRA_V2_NATS_CLUSTER_ID="${INDRA_V2_NATS_CLUSTER_ID:-abc123}"
INDRA_V2_NATS_TOKEN="${INDRA_V2_NATS_TOKEN:-abc123}"
INDRA_V2_ETH_RPC_KEY_RINKEBY="${INDRA_V2_ETH_RPC_KEY_RINKEBY:-abc123}"
INDRA_V2_ETH_RPC_KEY_KOVAN="${INDRA_V2_ETH_RPC_KEY_KOVAN:-abc123}"

####################
# Internal Config

log_level="3" # set to 5 for all logs or to 0 for none
mnemonic_name="node_mnemonic_$INDRA_V2_ETH_NETWORK"
mnemonic_file="/run/secrets/$mnemonic_name"

# Docker image settings
node_port=8080
nats_port=4222

if [[ "$INDRA_MODE" == "test" ]]
then
  db_volume="database_test_`date +%y%m%d_%H%M%S`"
  db_secret="${project}_database_test"
else
  db_volume="database"
  db_secret="${project}_database"
fi

# database connection settings
postgres_db="$project"
postgres_host="database"
postgres_password_file="/run/secrets/$db_secret"
postgres_port="5432"
postgres_user="$project"


if [[ "$INDRA_V2_ETH_NETWORK" == "mainnet" ]]
then
  eth_network_id="1"
  eth_rpc_url="https://eth-mainnet.alchemyapi.io/jsonrpc/$INDRA_V2_ETH_RPC_KEY_MAINNET"
elif [[ "$INDRA_V2_ETH_NETWORK" == "rinkeby" ]]
then
  eth_network_id="4"
  eth_rpc_url="https://eth-rinkeby.alchemyapi.io/jsonrpc/$INDRA_V2_ETH_RPC_KEY_RINKEBY"
elif [[ "$INDRA_V2_ETH_NETWORK" == "kovan" ]]
then 
  eth_network_id="42"
  eth_rpc_url="https://eth-kovan.alchemyapi.io/jsonrpc/$INDRA_V2_ETH_RPC_KEY_KOVAN"
elif [[ "$INDRA_V2_ETH_NETWORK" == "ganache" && "$INDRA_V2_MODE" == "test" ]]
then
  eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  eth_network_id="4447"
  eth_rpc_url="http://ethprovider:8545"
  ethprovider_image=${project}_builder
  number_of_services=$(( $number_of_services + 1 ))
  private_key="c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"
  new_secret $private_key_name $private_key
  ethprovider_service="
  ethprovider:
    image: ${project}_builder
    entrypoint: bash ops/entry.sh
    environment:
      ETH_MNEMONIC: \"$eth_mnemonic\"
      ETH_NETWORK: $INDRA_ETH_NETWORK
      ETH_PROVIDER: $eth_rpc_url
    ports:
      - \"8545:8545\"
    volumes:
      - \"`pwd`/modules/contracts:/root\""

else echo "Network $INDRA_ETH_NETWORK not supported for $MODE-mode deployments" && exit 1
fi

# Figure out which images we should use
if [[ "$INDRA_V2_DOMAINNAME" != "localhost" ]]
then
  if [[ "$INDRA_V2_MODE" == "live" ]]
  then version="`cat package.json | jq .version | tr -d '"'`"
  else version="latest" # staging mode
  fi
  database_image="postgres:9-alpine"
  nats_image="nats:2.0.0-linux"
  node_image="$registry/indra_v2_node:$version"
  proxy_image="$registry/indra_v2_proxy:$version"
  relay_image="$registry/indra_v2_relay:$version"
else # local mode, don't use images from registry
  database_image="postgres:9-alpine"
  nats_image="nats:2.0.0-linux"
  node_image="indra_v2_node:latest"
  proxy_image="indra_v2_proxy:latest"
  relay_image="indra_v2_relay:latest"
fi

####################
# Deploy according to above configuration

echo "Deploying node image: $node_image to $INDRA_V2_DOMAINNAME"

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then
    # But actually don't pull images if we're running locally
    if [[ "$INDRA_V2_DOMAINNAME" != "localhost" ]]
    then docker pull $1
    fi
  fi
}
pull_if_unavailable $database_image
pull_if_unavailable $nats_image
pull_if_unavailable $node_image

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
new_secret $db_secret
new_secret $mnemonic_name

number_of_services=5 # NOTE: Gotta update this manually when adding/removing services :(

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  $db_secret:
    external: true

volumes:
  $db_volume:
  certs:

services:
  $ethprovider_service

  proxy:
    image: $proxy_image
    environment:
      ETH_RPC_URL: $eth_rpc_url
      MESSAGING_URL: http://relay:4223
      MODE: prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt

  relay:
    image: $relay_image
    command: ["nats:$nats_port"]

  node:
    image: $node_image
    entrypoint: bash ops/entry.sh
    environment:
      INDRA_NATS_CLUSTER_ID: $INDRA_V2_NATS_CLUSTER_ID
      INDRA_NATS_SERVERS: nats://nats:$nats_port
      INDRA_NATS_TOKEN: $INDRA_V2_NATS_TOKEN
      INDRA_PG_DATABASE: $postgres_db
      INDRA_PG_HOST: $postgres_host
      INDRA_PG_PASSWORD_FILE: $postgres_password_file
      INDRA_PG_PORT: $postgres_port
      INDRA_PG_USERNAME: $postgres_user
      LOG_LEVEL: $log_level
      NODE_ENV: productoin
      ETH_MNEMONIC: $eth_mnemonic
      ETH_NETWORK: $INDRA_V2_ETH_NETWORK
      ETH_RPC_URL: $eth_rpc_url
      PORT: $node_port
    ports:
      - "80:$node_port"
    secrets:
      - $db_secret

  database:
    image: $database_image
    deploy:
      mode: global
    environment:
      ETH_NETWORK: $INDRA_V2_ETH_NETWORK
      MODE: dev
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_USER: $project
    secrets:
      - $db_secret
    volumes:
      - $db_volume:/var/lib/postgresql/data

  nats:
    image: $nats_image
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
