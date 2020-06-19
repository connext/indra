#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $dir/../package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Deploy with an attachable network in test-mode
# Delete/recreate the network first to delay docker network slowdowns that have been happening
docker network rm $project 2> /dev/null || true
docker network create --attachable --driver overlay $project 2> /dev/null || true

####################
# Load env vars

function extractEnv {
  grep "$1" "$2" | cut -d "=" -f 2- | tr -d '\n\r"' | sed 's/ *#.*//'
}

# First choice: use existing env vars (dotEnv not called)
function dotEnv {
  key="$1"
  if [[ -f .env && -n "`extractEnv $key .env`" ]] # Second choice: load from custom secret env
  then extractEnv $key .env
  elif [[ -f prod.env && -n "`extractEnv $key prod.env`" ]] # Third choice: load from public defaults
  then extractEnv $key prod.env
  fi
}

export INDRA_ADMIN_TOKEN="${INDRA_ADMIN_TOKEN:-`dotEnv INDRA_ADMIN_TOKEN`}"
export INDRA_AWS_ACCESS_KEY_ID="${INDRA_AWS_ACCESS_KEY_ID:-`dotEnv INDRA_AWS_ACCESS_KEY_ID`}"
export INDRA_AWS_SECRET_ACCESS_KEY="${INDRA_AWS_SECRET_ACCESS_KEY:-`dotEnv INDRA_AWS_SECRET_ACCESS_KEY`}"
export INDRA_DOMAINNAME="${INDRA_DOMAINNAME:-`dotEnv INDRA_DOMAINNAME`}"
export INDRA_EMAIL="${INDRA_EMAIL:-`dotEnv INDRA_EMAIL`}"
export INDRA_ETH_PROVIDER="${INDRA_ETH_PROVIDER:-`dotEnv INDRA_ETH_PROVIDER`}"
export INDRA_LOG_LEVEL="${INDRA_LOG_LEVEL:-`dotEnv INDRA_LOG_LEVEL`}"
export INDRA_LOGDNA_KEY="${INDRA_LOGDNA_KEY:-`dotEnv INDRA_LOGDNA_KEY`}"
export INDRA_MODE="${INDRA_MODE:-`dotEnv INDRA_MODE`}"
INDRA_NATS_JWT_SIGNER_PRIVATE_KEY="${INDRA_NATS_JWT_SIGNER_PRIVATE_KEY:-`dotEnv INDRA_NATS_JWT_SIGNER_PRIVATE_KEY`}"
INDRA_NATS_JWT_SIGNER_PUBLIC_KEY="${INDRA_NATS_JWT_SIGNER_PUBLIC_KEY:-`dotEnv INDRA_NATS_JWT_SIGNER_PUBLIC_KEY`}"

# Generate custom, secure JWT signing keys if we don't have any yet
if [[ -z "$INDRA_NATS_JWT_SIGNER_PRIVATE_KEY" ]]
then
  echo "WARNING: Generating new nats jwt signing keys & saving them in .env"
  echo "         You should back up .env to a safe location"
  keyFile=/tmp/indra/id_rsa
  mkdir -p /tmp/indra
  ssh-keygen -t rsa -b 4096 -m PEM -f $keyFile -N ""
  prvKey="`cat $keyFile | tr -d '\n\r'`"
  pubKey="`ssh-keygen -f $keyFile.pub -e -m PKCS8 | tr -d '\n\r'`"
  touch .env
  sed -i '/INDRA_NATS_JWT_SIGNER_/d' .env
  echo "INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=$pubKey" >> .env
  echo "INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=$prvKey" >> .env
  export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY="$pubKey"
  export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY="$prvKey"
  rm $keyFile $keyFile.pub
fi

# Ensure keys have proper newlines inserted
# (bc GitHub Actions strips newlines from secrets)
export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PRIVATE_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN RSA PRIVATE KEY-----/\\\n-----BEGIN RSA PRIVATE KEY-----\\\n/' |\
  sed 's/-----END RSA PRIVATE KEY-----/\\\n-----END RSA PRIVATE KEY-----\\\n/'`

export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PUBLIC_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN PUBLIC KEY-----/\\\n-----BEGIN PUBLIC KEY-----\\\n/' | \
  sed 's/-----END PUBLIC KEY-----/\\\n-----END PUBLIC KEY-----\\\n/'`

####################
# Internal Config

ganache_chain_id="1337"
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
  network="networks:
      - '$project'
    "
  stack_network="networks:
  $project:
    external: true"
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

# nats bearer auth settings
nats_port="4222"
nats_ws_port="4221"

# redis settings
redis_url="redis://redis:6379"

########################################
## Docker Image Config

if [[ "$INDRA_MODE" == "test"* ]]
then registry=""
else registry="${registry%/}/"
fi

if [[ "$INDRA_MODE" == *"staging" ]]
then version="`git rev-parse HEAD | head -c 8`"
elif [[ "$INDRA_MODE" == *"release" ]]
then version="`cat $dir/../package.json | grep '"version":' | head -n 1 | cut -d '"' -f 4`"
else echo "Unknown mode ($INDRA_MODE) for domain: $INDRA_DOMAINNAME. Aborting" && exit 1
fi

database_image="$registry${project}_database:$version"
logdna_image="logdna/logspout:v1.2.0"
nats_image="provide/nats-server:indra"
node_image="$registry${project}_node:$version"
proxy_image="$registry${project}_proxy:$version"
redis_image="redis:5-alpine"
webserver_image="$registry${project}_webserver:$version"

pull_if_unavailable "$database_image"
pull_if_unavailable "$logdna_image"
pull_if_unavailable "$nats_image"
pull_if_unavailable "$node_image"
pull_if_unavailable "$proxy_image"
pull_if_unavailable "$redis_image"
pull_if_unavailable "$webserver_image"

########################################
## Ethereum Config

eth_mnemonic_name="${project}_mnemonic"

if [[ -z "$INDRA_ETH_PROVIDER" ]]
then echo "An env var called INDRA_ETH_PROVIDER is required" && exit 1
elif [[ "$INDRA_ETH_PROVIDER" =~ .*://localhost:.* ]]
then chainId="$ganache_chain_id"
else chainId="`curl -q -k -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"net_version","params":[]}' $INDRA_ETH_PROVIDER | jq .result | tr -d '"'`"
fi

echo "eth provider: $INDRA_ETH_PROVIDER w chainId: $chainId"

# Prefer top-level address-book override otherwise default to one in contracts
if [[ -f address-book.json ]]
then eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
else eth_contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
fi

token_address="`echo $eth_contract_addresses | jq '.["'"$chainId"'"].Token.address' | tr -d '"'`"

if [[ "$chainId" == "$ganache_chain_id" ]]
then
  ethprovider_image="$registry${project}_ethprovider:$version"
  pull_if_unavailable "$ethprovider_image"
  eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  new_secret "$eth_mnemonic_name" "$eth_mnemonic"
  eth_volume="chain_dev:"
  number_of_services=$(( $number_of_services + 1 ))
  ethprovider_service="
  ethprovider:
    image: '$ethprovider_image'
    command: 'start'
    environment:
      ETH_MNEMONIC: '$eth_mnemonic'
    ports:
      - '8545:8545'
    volumes:
      - '$eth_volume/data'
    $network
  "
  INDRA_ETH_PROVIDER="http://ethprovider:8545"
  MODE=${INDRA_MODE#*-} bash ops/deploy-contracts.sh
fi

allowed_swaps='[{"from":"'"$token_address"'","to":"0x0000000000000000000000000000000000000000","priceOracleType":"UNISWAP"},{"from":"0x0000000000000000000000000000000000000000","to":"'"$token_address"'","priceOracleType":"UNISWAP"}]'

supported_tokens="$token_address,0x0000000000000000000000000000000000000000"

########################################
## Deploy according to configuration

echo "Deploying $number_of_services services eg node=$node_image to $INDRA_DOMAINNAME"

mkdir -p `pwd`/ops/database/snapshots
mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

$stack_network

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
    image: '$proxy_image'
    environment:
      DOMAINNAME: '$INDRA_DOMAINNAME'
      EMAIL: '$INDRA_EMAIL'
      ETH_PROVIDER_URL: '$INDRA_ETH_PROVIDER'
      MESSAGING_TCP_URL: 'nats:4222'
      MESSAGING_WS_URL: 'nats:4221'
      NODE_URL: 'node:8080'
      WEBSERVER_URL: 'webserver:80'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'
    ports:
      - '80:80'
      - '443:443'
      - '4221:4221'
      - '4222:4222'
    volumes:
      - 'certs:/etc/letsencrypt'
    $network

  webserver:
    image: '$webserver_image'
    $network

  node:
    image: '$node_image'
    entrypoint: 'bash ops/entry.sh'
    environment:
      INDRA_ADMIN_TOKEN: '$INDRA_ADMIN_TOKEN'
      INDRA_ALLOWED_SWAPS: '$allowed_swaps'
      INDRA_SUPPORTED_TOKENS: '$supported_tokens'
      INDRA_ETH_CONTRACT_ADDRESSES: '$eth_contract_addresses'
      INDRA_ETH_MNEMONIC_FILE: '/run/secrets/$eth_mnemonic_name'
      INDRA_ETH_RPC_URL: '$INDRA_ETH_PROVIDER'
      INDRA_LOG_LEVEL: '$INDRA_LOG_LEVEL'
      INDRA_NATS_JWT_SIGNER_PRIVATE_KEY: '$INDRA_NATS_JWT_SIGNER_PRIVATE_KEY'
      INDRA_NATS_JWT_SIGNER_PUBLIC_KEY: '$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY'
      INDRA_NATS_SERVERS: 'nats://nats:$nats_port'
      INDRA_NATS_WS_ENDPOINT: 'wss://nats:$nats_ws_port'
      INDRA_PG_DATABASE: '$pg_db'
      INDRA_PG_HOST: '$pg_host'
      INDRA_PG_PASSWORD_FILE: '$pg_password_file'
      INDRA_PG_PORT: '$pg_port'
      INDRA_PG_USERNAME: '$pg_user'
      INDRA_PORT: '$node_port'
      INDRA_REDIS_URL: '$redis_url'
      NODE_ENV: 'production'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'
    secrets:
      - '$db_secret'
      - '$eth_mnemonic_name'
    $network

  database:
    image: '$database_image'
    deploy:
      mode: 'global'
    environment:
      AWS_ACCESS_KEY_ID: '$INDRA_AWS_ACCESS_KEY_ID'
      AWS_SECRET_ACCESS_KEY: '$INDRA_AWS_SECRET_ACCESS_KEY'
      CHAIN_ID: '$chainId'
      POSTGRES_DB: '$project'
      POSTGRES_PASSWORD_FILE: '$pg_password_file'
      POSTGRES_USER: '$project'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'
    secrets:
      - '$db_secret'
    volumes:
      - '$db_volume:/var/lib/postgresql/data'
      - '`pwd`/ops/database/snapshots:/root/snapshots'
    $network

  nats:
    image: '$nats_image'
    command: '-D -V'
    environment:
      JWT_SIGNER_PUBLIC_KEY: '$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'
    $network

  redis:
    image: '$redis_image'
    $network

  logdna:
    image: '$logdna_image'
    environment:
      LOGDNA_KEY: '$INDRA_LOGDNA_KEY'
    volumes:
      - '/var/run/docker.sock:/var/run/docker.sock'
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
