#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

localProvider="http://ethprovider:8545"

####################
# External Env Vars

INDRA_ETH_PROVIDER="${INDRA_ETH_PROVIDER:-$localProvider}"
INDRA_ADMIN_TOKEN="${INDRA_ADMIN_TOKEN:-foo}"
INDRA_UI="${INDRA_UI:-daicard}"
log_level="${LOG_LEVEL:-3}"

####################
# Internal Config
# config & hard-coded stuff you might want to change

number_of_services=4 # NOTE: Gotta update this manually when adding/removing services :(

log_level=3
nats_port=4222
node_port=8080
dash_port=9999
ui_port=3000
ganacheId="4447"

# Prefer top-level address-book override otherwise default to one in contracts
if [[ -f address-book.json ]]
then eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
else eth_contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
fi
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

if [[ "$INDRA_ETH_PROVIDER" == "$localProvider" ]]
then chainId="$ganacheId"
else
  echo "Fetching chainId from ${INDRA_ETH_PROVIDER}"
  chainId="`curl -q -k -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"net_version","params":[]}' $INDRA_ETH_PROVIDER | jq .result | tr -d '"'`"
fi

token_address="`echo $eth_contract_addresses | jq '.["'"$chainId"'"].Token.address' | tr -d '"'`"
allowed_swaps="[{\"from\":\"$token_address\",\"to\":\"0x0000000000000000000000000000000000000000\",\"priceOracleType\":\"UNISWAP\"},{\"from\":\"0x0000000000000000000000000000000000000000\",\"to\":\"$token_address\",\"priceOracleType\":\"UNISWAP\"}]"

if [[ -z "$chainId" ]]
then echo "Failed to fetch chainId from provider ${INDRA_ETH_PROVIDER}" && exit 1;
else echo "Got chainId $chainId, using token $token_address"
fi

if [[ "$chainId" == "$ganacheId" ]]
then make deployed-contracts
fi

# database connection settings
pg_db="$project"
pg_password_file="/run/secrets/${project}_database_dev"
pg_host="database"
pg_port="5432"
pg_user="$project"

# docker images
builder_image="${project}_builder"
ui_image="$builder_image"
database_image="postgres:9-alpine"
ethprovider_image="$builder_image"
nats_image="provide/nats-server:latest"
node_image="$builder_image"
proxy_image="${project}_proxy"
redis_image=redis:5-alpine
redis_url="redis://redis:6379"

####################
# Deploy according to above configuration

if [[ "$INDRA_UI" == "headless" ]]
then
  ui_service=""
  proxy_mode="ci"
  proxy_ui_url=""
else
  if [[ "$INDRA_UI" == "dashboard" ]]
  then ui_working_dir=/root/modules/dashboard
  elif [[ "$INDRA_UI" == "daicard" ]]
  then ui_working_dir=/root/modules/daicard
  else
    echo "INDRA_UI: Expected headless, dashboard, or daicard"
    exit 1
  fi
  number_of_services=$(( $number_of_services + 3 ))
  proxy_mode="dev"
  proxy_ui_url="http://ui:3000"
  ui_services="
  proxy:
    image: $proxy_image
    environment:
      DOMAINNAME: localhost
      ETH_RPC_URL: $INDRA_ETH_PROVIDER
      MESSAGING_URL: http://relay:4223
      MODE: $proxy_mode
      UI_URL: $proxy_ui_url
    networks:
      - $project
    ports:
      - "$ui_port:80"
    volumes:
      - certs:/etc/letsencrypt

  ui:
    image: $ui_image
    entrypoint: npm start
    environment:
      NODE_ENV: development
    networks:
      - $project
    volumes:
      - `pwd`:/root
    working_dir: $ui_working_dir
  "
fi

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}
pull_if_unavailable "$database_image"
pull_if_unavailable "$ethprovider_image"
pull_if_unavailable "$nats_image"

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
new_secret "${project}_database_dev" "$project"

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

volumes:
  certs:
  chain_dev:
  database_dev:

services:

  $ui_services

  node:
    image: $node_image
    entrypoint: bash modules/node/ops/entry.sh
    environment:
      INDRA_ADMIN_TOKEN: $INDRA_ADMIN_TOKEN
      INDRA_ALLOWED_SWAPS: '$allowed_swaps'
      INDRA_ETH_CONTRACT_ADDRESSES: '$eth_contract_addresses'
      INDRA_ETH_MNEMONIC: $eth_mnemonic
      INDRA_ETH_RPC_URL: $INDRA_ETH_PROVIDER
      INDRA_LOG_LEVEL: $log_level
      INDRA_NATS_CLUSTER_ID:
      INDRA_NATS_SERVERS: nats://nats:$nats_port
      INDRA_NATS_TOKEN:
      INDRA_PG_DATABASE: $pg_db
      INDRA_PG_HOST: $pg_host
      INDRA_PG_PASSWORD_FILE: $pg_password_file
      INDRA_PG_PORT: $pg_port
      INDRA_PG_USERNAME: $pg_user
      INDRA_PORT: $node_port
      INDRA_REDIS_URL: $redis_url
      NODE_ENV: development
    networks:
      - $project
    ports:
      - "$node_port:$node_port"
    secrets:
      - ${project}_database_dev
    volumes:
      - `pwd`:/root

  ethprovider:
    image: $ethprovider_image
    entrypoint: bash modules/contracts/ops/entry.sh
    command: "start"
    environment:
      ETH_MNEMONIC: $eth_mnemonic
    networks:
      - $project
    ports:
      - "8545:8545"
    volumes:
      - `pwd`:/root
      - chain_dev:/data

  database:
    image: $database_image
    deploy:
      mode: global
    environment:
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $pg_password_file
      POSTGRES_USER: $project
    networks:
      - $project
    ports:
      - "$pg_port:$pg_port"
    secrets:
      - ${project}_database_dev
    volumes:
      - database_dev:/var/lib/postgresql/data

  nats:
    command: -V
    image: $nats_image
    networks:
      - $project
    ports:
      - "$nats_port:$nats_port"

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
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
