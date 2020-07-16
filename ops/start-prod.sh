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
export INDRA_CHAIN_PROVIDERS="${INDRA_CHAIN_PROVIDERS:-`dotEnv INDRA_CHAIN_PROVIDERS`}"
export INDRA_DOMAINNAME="${INDRA_DOMAINNAME:-`dotEnv INDRA_DOMAINNAME`}"
export INDRA_EMAIL="${INDRA_EMAIL:-`dotEnv INDRA_EMAIL`}"
export INDRA_LOG_LEVEL="${INDRA_LOG_LEVEL:-`dotEnv INDRA_LOG_LEVEL`}"
export INDRA_LOGDNA_KEY="${INDRA_LOGDNA_KEY:-`dotEnv INDRA_LOGDNA_KEY`}"
export INDRA_MODE="${INDRA_MODE:-`dotEnv INDRA_MODE`}"
INDRA_NATS_JWT_SIGNER_PRIVATE_KEY="${INDRA_NATS_JWT_SIGNER_PRIVATE_KEY:-`dotEnv INDRA_NATS_JWT_SIGNER_PRIVATE_KEY`}"
INDRA_NATS_JWT_SIGNER_PUBLIC_KEY="${INDRA_NATS_JWT_SIGNER_PUBLIC_KEY:-`dotEnv INDRA_NATS_JWT_SIGNER_PUBLIC_KEY`}"

# Generate custom, secure JWT signing keys if we don't have any yet
if [[ -z "$INDRA_NATS_JWT_SIGNER_PRIVATE_KEY" ]]
then
  echo "WARNING: Generating new nats jwt signing keys & saving them in .env"
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
# Configure or launch Ethereum testnets

eth_mnemonic_name="${project}_mnemonic"

# If no chain providers provided, spin up local testnets & use those
if [[ -z "$INDRA_CHAIN_PROVIDERS" ]]
then

  echo 'No $INDRA_CHAIN_PROVIDERS provided, spinning up local testnets & using those.'

  eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  bash ops/save-secret.sh "$eth_mnemonic_name" "$eth_mnemonic"

  chain_id_1=1337
  chain_port_1=8545
  chain_url_1="http://172.17.0.1:$chain_port_1"
  chain_host_1="${project}_testnet_$chain_id_1"

  chain_id_2=1338
  chain_port_2=8546
  chain_url_2="http://172.17.0.1:$chain_port_2"
  chain_host_2="${project}_testnet_$chain_id_2"

  chain_providers='{"'$chain_id_1'":"'$chain_url_1'","'$chain_id_2'":"'$chain_url_2'"}'

  echo "Starting $chain_host_1 & $chain_host_2.."
  export INDRA_TESTNET_MNEMONIC=$eth_mnemonic

  # NOTE: Start script for buidler testnet will return before it's actually ready to go.
  # Run buidlerevm first so that it can finish while we're waiting for ganache to get set up
  export INDRA_TESTNET_PORT=$chain_port_2
  export INDRA_TESTNET_ENGINE=buidler
  bash ops/start-eth-provider.sh $chain_id_2 $chain_tag_2

  export INDRA_TESTNET_PORT=$chain_port_1
  export INDRA_TESTNET_ENGINE=ganache
  bash ops/start-eth-provider.sh $chain_id_1 $chain_tag_1

  # Pull the tmp address books out of each chain provider & merge them into one
  address_book_1=`docker exec $chain_host_1 cat /tmpfs/address-book.json`
  address_book_2=`docker exec $chain_host_2 cat /tmpfs/address-book.json`
  eth_contract_addresses=`echo $address_book_1 $address_book_2 | jq -s '.[0] * .[1]'`

# If chain providers are provided, use those
else

  # Prefer top-level address-book override otherwise default to one in contracts
  if [[ -f address-book.json ]]
  then eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
  else eth_contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
  fi

fi

####################
# Launch Indra stack

echo "Deploying $node_image to $INDRA_DOMAINNAME"

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
  proxy:
    image: '$proxy_image'
    environment:
      DOMAINNAME: '$INDRA_DOMAINNAME'
      EMAIL: '$INDRA_EMAIL'
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
    environment:
      INDRA_ADMIN_TOKEN: '$INDRA_ADMIN_TOKEN'
      INDRA_CHAIN_PROVIDERS: '$chain_providers'
      INDRA_ETH_CONTRACT_ADDRESSES: '$eth_contract_addresses'
      INDRA_ETH_MNEMONIC_FILE: '/run/secrets/$eth_mnemonic_name'
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
while ! curl -s http://localhost:80 > /dev/null
do echo -n "." && sleep 2
done
echo " Good Morning!"
