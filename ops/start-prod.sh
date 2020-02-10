#!/usr/bin/env bash
set -e

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

####################
# External Env Vars

INDRA_AWS_ACCESS_KEY_ID="${INDRA_AWS_ACCESS_KEY_ID:-}"
INDRA_AWS_SECRET_ACCESS_KEY="${INDRA_AWS_SECRET_ACCESS_KEY:-}"
INDRA_DOMAINNAME="${INDRA_DOMAINNAME:-localhost}"
INDRA_EMAIL="${INDRA_EMAIL:-noreply@gmail.com}" # for notifications when ssl certs expire
INDRA_ETH_PROVIDER="${INDRA_ETH_PROVIDER}"
INDRA_LOGDNA_KEY="${INDRA_LOGDNA_KEY:-abc123}"
INDRA_MODE="${INDRA_MODE:-test-staging}" # One of: release, staging, test-staging, or test-release
INDRA_ADMIN_TOKEN="${INDRA_ADMIN_TOKEN:-cxt1234}" # pass this in through CI

####################
# Internal Config

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | jq .name | tr -d '"'`"
ganache_chain_id="4447"
log_level="3" # set to 5 for all logs or to 0 for none
nats_port="4222"
node_port="8080"
number_of_services="7" # NOTE: Gotta update this manually when adding/removing services :(

####################
# Helper Functions

# Initialize new secrets (random if no value is given)
function new_secret {
  secret="$2"
  if [[ -z "$secret" ]]
  then secret=`head -c 32 /dev/urandom | xxd -plain -c 32 | tr -d '\n\r'`
  fi
  if [[ -z "`docker secret ls -f name=$1 | grep -w $1`" ]]
  then
    id=`echo "$secret" | tr -d '\n\r' | docker secret create $1 -`
    echo "Created secret called $1 with id $id"
  fi
}

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

########################################
## Database Conig

if [[ "$INDRA_MODE" == "test"* ]]
then
  db_volume="database_test_`date +%y%m%d_%H%M%S`"
  db_secret="${project}_database_test"
  new_secret "$db_secret" "$project"
  db_port='ports:
      - "5432:5432"
  '
else
  db_volume="database"
  db_secret="${project}_database"
  new_secret $db_secret
fi

# database connection settings
pg_db="$project"
pg_host="database"
pg_password_file="/run/secrets/$db_secret"
pg_port="5432"
pg_user="$project"

redis_url="redis://redis:6379"

########################################
## Docker Image Config

if [[ "$INDRA_MODE" == "test"* ]]
then registry=""
else registry="docker.io/connextproject/"
fi

if [[ "$INDRA_MODE" == *"staging" ]]
then version="`git rev-parse HEAD | head -c 8`"
elif [[ "$INDRA_MODE" == *"release" ]]
then version="`cat package.json | jq .version | tr -d '"'`"
else echo "Unknown mode ($INDRA_MODE) for domain: $INDRA_DOMAINNAME. Aborting" && exit 1
fi

ethprovider_image="$registry${project}_ethprovider:$version"
database_image="$registry${project}_database:$version"
logdna_image="logdna/logspout:1.2.0"
nats_image="nats:2.0.0-linux"
node_image="$registry${project}_node:$version"
proxy_image="$registry${project}_proxy:$version"
redis_image="redis:5-alpine"
relay_image="$registry${project}_relay:$version"

pull_if_unavailable "$database_image"
pull_if_unavailable "$logdna_image"
pull_if_unavailable "$nats_image"
pull_if_unavailable "$node_image"
pull_if_unavailable "$proxy_image"
pull_if_unavailable "$redis_image"
pull_if_unavailable "$relay_image"

########################################
## Ethereum Config

if [[ -z "$INDRA_ETH_PROVIDER" ]]
then echo "An env var called INDRA_ETH_PROVIDER is required" && exit 1
elif [[ "$INDRA_ETH_PROVIDER" =~ .*://localhost:.* ]]
then chainId="$ganache_chain_id"
else chainId="`curl -q -k -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"net_version","params":[]}' $INDRA_ETH_PROVIDER | jq .result | tr -d '"'`"
fi

echo "eth provider: $INDRA_ETH_PROVIDER w chainId: $chainId"

if [[ "$chainId" == "$ganache_chain_id" ]]
then
  eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  eth_mnemonic_name="${project}_mnemonic_$chainId"
  new_secret "$eth_mnemonic_name" "$eth_mnemonic"
  eth_volume="chain_dev:"
  number_of_services=$(( $number_of_services + 1 ))
  ethprovider_service="
  ethprovider:
    image: $ethprovider_image
    command: \"start\"
    environment:
      ETH_MNEMONIC: $eth_mnemonic
    ports:
      - 8545:8545
    volumes:
      - $eth_volume/data
  "
  INDRA_ETH_PROVIDER="http://ethprovider:8545"
  pull_if_unavailable "$ethprovider_image"
  MODE=${INDRA_MODE#*-} bash ops/deploy-contracts.sh
else echo "Eth network \"$chainId\" is not supported for $INDRA_MODE-mode deployments" && exit 1
fi

# Prefer top-level address-book override otherwise default to one in contracts
if [[ -f address-book.json ]]
then eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
else eth_contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
fi
eth_mnemonic_name="${project}_mnemonic_$chainId"

########################################
## Deploy according to configuration

echo "Deploying node image: $node_image to $INDRA_DOMAINNAME"

mkdir -p modules/database/snapshots /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  $db_secret:
    external: true
  $eth_mnemonic_name:
    external: true

volumes:
  certs:
  $db_volume:
  $eth_volume

services:
  $ethprovider_service

  proxy:
    image: $proxy_image
    environment:
      DOMAINNAME: $INDRA_DOMAINNAME
      EMAIL: $INDRA_EMAIL
      ETH_RPC_URL: $INDRA_ETH_PROVIDER
      MESSAGING_URL: http://relay:4223
      MODE: prod
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

  node:
    image: $node_image
    entrypoint: bash ops/entry.sh
    environment:
      INDRA_ADMIN_TOKEN: $INDRA_ADMIN_TOKEN
      INDRA_ETH_CONTRACT_ADDRESSES: '$eth_contract_addresses'
      INDRA_ETH_MNEMONIC_FILE: /run/secrets/$eth_mnemonic_name
      INDRA_ETH_RPC_URL: $INDRA_ETH_PROVIDER
      INDRA_LOG_LEVEL: $log_level
      INDRA_NATS_CLUSTER_ID: abc123
      INDRA_NATS_SERVERS: nats://nats:$nats_port
      INDRA_NATS_TOKEN: abc123
      INDRA_PG_DATABASE: $pg_db
      INDRA_PG_HOST: $pg_host
      INDRA_PG_PASSWORD_FILE: $pg_password_file
      INDRA_PG_PORT: $pg_port
      INDRA_PG_USERNAME: $pg_user
      INDRA_PORT: $node_port
      INDRA_REDIS_URL: $redis_url
      NODE_ENV: production
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    secrets:
      - $db_secret
      - $eth_mnemonic_name

  database:
    image: $database_image
    deploy:
      mode: global
    environment:
      AWS_ACCESS_KEY_ID: $INDRA_AWS_ACCESS_KEY_ID
      AWS_SECRET_ACCESS_KEY: $INDRA_AWS_SECRET_ACCESS_KEY
      ETH_NETWORK: $chainId
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $pg_password_file
      POSTGRES_USER: $project
    secrets:
      - $db_secret
    volumes:
      - $db_volume:/var/lib/postgresql/data
      - `pwd`/modules/database/snapshots:/root/snapshots
    $db_port

  nats:
    image: $nats_image
    command: -V
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    ports:
      - "4222:4222"

  relay:
    image: $relay_image
    command: ["nats:$nats_port"]
    ports:
      - "4223:4223"

  redis:
    image: $redis_image
    ports:
      - "6379:6379"

  logdna:
    image: $logdna_image
    environment:
      LOGDNA_KEY: $INDRA_LOGDNA_KEY
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
