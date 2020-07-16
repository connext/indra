#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Deploy with an attachable network so tests & the daicard can connect to individual components
# Delete/recreate the network first to delay docker network slowdowns that have been happening
docker network rm $project 2> /dev/null || true
docker network create --attachable --driver overlay $project 2> /dev/null || true

####################
# Load env vars

# alias env var
INDRA_LOG_LEVEL="$LOG_LEVEL";

function extractEnv {
  grep "$1" "$2" | cut -d "=" -f 2- | tr -d '\n\r"' | sed 's/ *#.*//'
}

# First choice: use existing env vars (dotEnv not called)
function dotEnv {
  key="$1"
  if [[ -f .env && -n "`extractEnv $key .env`" ]] # Second choice: load from custom secret env
  then extractEnv $key .env
  elif [[ -f dev.env && -n "`extractEnv $key dev.env`" ]] # Third choice: load from public defaults
  then extractEnv $key dev.env
  fi
}

export INDRA_ADMIN_TOKEN="${INDRA_ADMIN_TOKEN:-`dotEnv INDRA_ADMIN_TOKEN`}"
export INDRA_CHAIN_PROVIDERS="${INDRA_CHAIN_PROVIDERS:-`dotEnv INDRA_CHAIN_PROVIDERS`}"
export INDRA_ETH_PROVIDER="${INDRA_ETH_PROVIDER:-`dotEnv INDRA_ETH_PROVIDER`}"
export INDRA_ETH_PROVIDER_2="${PROVIDER_2:-`dotEnv PROVIDER_2`}"
export INDRA_LOG_LEVEL="${INDRA_LOG_LEVEL:-`dotEnv INDRA_LOG_LEVEL`}"
INDRA_NATS_JWT_SIGNER_PRIVATE_KEY="${INDRA_NATS_JWT_SIGNER_PRIVATE_KEY:-`dotEnv INDRA_NATS_JWT_SIGNER_PRIVATE_KEY`}"
INDRA_NATS_JWT_SIGNER_PUBLIC_KEY="${INDRA_NATS_JWT_SIGNER_PUBLIC_KEY:-`dotEnv INDRA_NATS_JWT_SIGNER_PUBLIC_KEY`}"

# Make sure keys have proper newlines inserted (bc GitHub Actions strips newlines from secrets)
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
# config & hard-coded stuff you might want to change

number_of_services=6 # NOTE: Gotta update this manually when adding/removing services :(

nats_port=4222
node_port=8080
dash_port=9999
webserver_port=3000

# database connection settings
pg_db="$project"
pg_password_file="/run/secrets/${project}_database_dev"
pg_host="database"
pg_port="5432"
pg_user="$project"

nats_port="4222"
nats_ws_port="4221"

# docker images
builder_image="${project}_builder"
webserver_image="$builder_image"
database_image="${project}_database"
ethprovider_image="$builder_image"
nats_image="provide/nats-server:indra"
node_image="$builder_image"
proxy_image="${project}_proxy"
redis_image="redis:5-alpine"

####################
# Configure UI

if [[ "$INDRA_UI" == "headless" ]]
then
  webserver_service=""
  webserver_url="localhost"
else
  if [[ "$INDRA_UI" == "dashboard" ]]
  then webserver_working_dir=/root/modules/dashboard
  elif [[ "$INDRA_UI" == "daicard" ]]
  then webserver_working_dir=/root/modules/daicard
  else
    echo "INDRA_UI: Expected headless, dashboard, or daicard"
    exit 1
  fi
  number_of_services=$(( $number_of_services + 1 ))
  webserver_url="webserver:3000"
  webserver_services="
  webserver:
    image: '$webserver_image'
    entrypoint: 'npm start'
    environment:
      NODE_ENV: 'development'
    networks:
      - '$project'
    volumes:
      - '`pwd`:/root'
    working_dir: '$webserver_working_dir'
  "
fi

####################
# Make sure images are pulled & external secrets are created

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}
pull_if_unavailable "$database_image"
pull_if_unavailable "$nats_image"
pull_if_unavailable "$redis_image"

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

########################################
# Start Ethereum testnets

eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

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

####################
# Launch Indra stack

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
  chain_1337:
  chain_1338:
  database_dev:

services:

  $webserver_services

  proxy:
    image: '$proxy_image'
    environment:
      ETH_PROVIDER_URL: '$INDRA_ETH_PROVIDER'
      ETH_PROVIDER_URL_2: '$INDRA_ETH_PROVIDER_2'
      MESSAGING_TCP_URL: 'nats:4222'
      MESSAGING_WS_URL: 'nats:4221'
      NODE_URL: 'node:8080'
      WEBSERVER_URL: 'webserver:3000'
    networks:
      - '$project'
    ports:
      - '3000:80'
    volumes:
      - 'certs:/etc/letsencrypt'

  node:
    image: '$node_image'
    entrypoint: 'bash modules/node/ops/entry.sh'
    environment:
      INDRA_ADMIN_TOKEN: '$INDRA_ADMIN_TOKEN'
      INDRA_ETH_CONTRACT_ADDRESSES: '$eth_contract_addresses'
      INDRA_ETH_MNEMONIC: '$eth_mnemonic'
      INDRA_CHAIN_PROVIDERS: '$chain_providers'
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
      INDRA_REDIS_URL: 'redis://redis:6379'
      NODE_ENV: 'development'
    networks:
      - '$project'
    ports:
      - '$node_port:$node_port'
      - '9229:9229'
    secrets:
      - '${project}_database_dev'
    volumes:
      - '`pwd`:/root'

  database:
    image: '$database_image'
    deploy:
      mode: 'global'
    environment:
      CHAIN_ID: '$chainId'
      POSTGRES_DB: '$project'
      POSTGRES_PASSWORD_FILE: '$pg_password_file'
      POSTGRES_USER: '$project'
    networks:
      - '$project'
    ports:
      - '$pg_port:$pg_port'
    secrets:
      - '${project}_database_dev'
    volumes:
      - 'database_dev:/var/lib/postgresql/data'

  nats:
    command: -D -V
    image: '$nats_image'
    environment:
      JWT_SIGNER_PUBLIC_KEY: '$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY'
    networks:
      - '$project'
    ports:
      - '$nats_port:$nats_port'
      - '$nats_ws_port:$nats_ws_port'

  redis:
    image: '$redis_image'
    networks:
      - '$project'
    ports:
      - '6379:6379'

EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
