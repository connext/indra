#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"
tmp="$root/.tmp"; mkdir -p $tmp

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Deploy with an attachable network in test-mode
# Delete/recreate the network first to delay docker network slowdowns that have been happening
docker network rm $project 2> /dev/null || true
docker network create --attachable --driver overlay $project 2> /dev/null || true

####################
# Load env vars

INDRA_ENV="${INDRA_ENV:-dev}"

# Load the default env
if [[ -f "${INDRA_ENV}.env" ]]
then source "${INDRA_ENV}.env"
fi

# Load instance-specific env vars & overrides
if [[ -f ".env" ]]
then source .env
fi

echo "Launching indra in env `env | grep INDRA_`"

# log level alias can override default for easy `LOG_LEVEL=5 make start`
INDRA_LOG_LEVEL="${LOG_LEVEL:-INDRA_LOG_LEVEL}";

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
## Docker Image Config

if [[ "$INDRA_ENV" == "test"* ]]
then registry=""
else registry="${registry%/}/"
fi

# prod version: if we're on a tagged commit then use the tagged semvar, otherwise use the hash
if [[ "$INDRA_ENV" == "prod" ]]
then
  git_tag="`git tag --points-at HEAD | grep "indra-" | head -n 1`"
  if [[ -n "$git_tag" ]]
  then version="`$git_tag | sed 's/indra-//'`"
  else version="`cat $root/package.json | grep '"version":' | head -n 1 | cut -d '"' -f 4`"
  fi
else version="latest"
fi

echo "Using docker images ${registry}indra_name:${version} "

####################
# Misc Config

builder_image="${project}_builder"

logdna_image="logdna/logspout:v1.2.0";
pull_if_unavailable "$logdna_image"

redis_image="redis:5-alpine";
pull_if_unavailable "$redis_image"

# to access from other containers
redis_url="redis://redis:6379"

####################
# Proxy config

# to access from host
proxy_url="http://localhost:80"

proxy_image="$registry${project}_proxy:$version";
pull_if_unavailable "$proxy_image"

if [[ "$INDRA_ENV" == "prod" ]]
then
  proxy_ports="ports:
      - '80:80'
      - '443:443'
      - '4221:4221'
      - '4222:4222'"
else
  proxy_ports="ports:
      - '3000:80'
      - '4221:4221'
      - '4222:4222'"
fi

echo "Proxy configured"

####################
# Nats config

nats_image="provide/nats-server:indra";
pull_if_unavailable "$nats_image"

nats_port="4222"
nats_ws_port="4221"

# Generate custom, secure JWT signing keys if we don't have any yet
if [[ -z "$INDRA_NATS_JWT_SIGNER_PRIVATE_KEY" ]]
then
  echo "WARNING: Generating new nats jwt signing keys & saving them in .env"
  keyFile=$tmp/id_rsa
  ssh-keygen -t rsa -b 4096 -m PEM -f $keyFile -N "" > /dev/null
  prvKey="`cat $keyFile | tr -d '\n\r'`"
  pubKey="`ssh-keygen -f $keyFile.pub -e -m PKCS8 | tr -d '\n\r'`"
  touch .env
  sed -i '/INDRA_NATS_JWT_SIGNER_/d' .env
  echo "export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=\"$pubKey\"" >> .env
  echo "export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=\"$prvKey\"" >> .env
  export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY="$pubKey"
  export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY="$prvKey"
  rm $keyFile $keyFile.pub
fi

# Ensure keys have proper newlines inserted (bc newlines are stripped from GitHub secrets)
export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PRIVATE_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN RSA PRIVATE KEY-----/\\\n-----BEGIN RSA PRIVATE KEY-----\\\n/' |\
  sed 's/-----END RSA PRIVATE KEY-----/\\\n-----END RSA PRIVATE KEY-----\\\n/'`
export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PUBLIC_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN PUBLIC KEY-----/\\\n-----BEGIN PUBLIC KEY-----\\\n/' | \
  sed 's/-----END PUBLIC KEY-----/\\\n-----END PUBLIC KEY-----\\\n/'`

echo "Nats configured"

########################################
## Node config

if [[ $INDRA_ENV == "prod" ]]
then
  node_image_name="$registry${project}_node:$version"
  pull_if_unavailable "$node_image_name"
  node_image="image: '$node_image_name'"
else
  node_image="image: '${project}_builder'
    entrypoint: 'bash modules/node/ops/entry.sh'
    volumes:
      - '$root:/root'
    ports:
      - '$node_port:$node_port'
      - '9229:9229'"
fi

echo "Node configured"

########################################
## Database config

database_image="$registry${project}_database:$version";
pull_if_unavailable "$database_image"

snapshots_dir="$root/.db-snapshots"

mkdir -p $snapshots_dir

if [[ "$INDRA_ENV" == "test"* ]]
then
  db_volume="database_test_`date +%y%m%d_%H%M%S`"
  db_secret="${project}_database_test"
  new_secret "$db_secret" "$project"
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

echo "Database configured"

########################################
# Chain provider config

mnemonic_secret_name="${project}_mnemonic"
INDRA_MNEMONIC_FILE="/run/secrets/$mnemonic_secret_name"

# If no chain providers provided, spin up local testnets & use those
if [[ -z "$INDRA_CHAIN_PROVIDERS" ]]
then
  echo 'No $INDRA_CHAIN_PROVIDERS provided, spinning up local testnets & using those.'
  eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  bash ops/save-secret.sh "$mnemonic_secret_name" "$eth_mnemonic"
  chain_id_1=1337; chain_id_2=1338;
  INDRA_CHAIN_MODE="${INDRA_ENV#test-}" bash ops/start-testnet.sh $chain_id_1 $chain_id_2
  INDRA_CHAIN_PROVIDERS="`cat $root/.chaindata/providers/${chain_id_1}-${chain_id_2}.json`"
  INDRA_CONTRACT_ADDRESSES="`cat $root/.chaindata/addresses/${chain_id_1}-${chain_id_2}.json`"

# If chain providers are provided, use those
else
  echo "Using chain providers:" $INDRA_CHAIN_PROVIDERS
  # Prefer top-level address-book override otherwise default to one in contracts
  if [[ -f address-book.json ]]
  then INDRA_CONTRACT_ADDRESSES="`cat address-book.json | tr -d ' \n\r'`"
  else INDRA_CONTRACT_ADDRESSES="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
  fi
fi

ETH_PROVIDER_URL="`echo $INDRA_CHAIN_PROVIDERS | tr -d "'" | jq '.[]' | head -n 1 | tr -d '"'`"

# TODO: filter out contract addresses that are not for our chain providers

echo "Chain providers configured"

####################
# Launch Indra stack

echo "Launching indra"

cat - > $root/docker-compose.yml <<EOF
version: '3.4'

$stack_network

secrets:
  $db_secret:
    external: true
  $mnemonic_secret_name:
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
      ETH_PROVIDER_URL: '$ETH_PROVIDER_URL'
      MESSAGING_TCP_URL: 'nats:4222'
      MESSAGING_WS_URL: 'nats:4221'
      NODE_URL: 'node:8080'
      WEBSERVER_URL: 'webserver:80'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'
    volumes:
      - 'certs:/etc/letsencrypt'
    networks:
      - '$project'
    $proxy_ports

  node:
    $node_image
    environment:
      INDRA_ADMIN_TOKEN: '$INDRA_ADMIN_TOKEN'
      INDRA_CHAIN_PROVIDERS: '$INDRA_CHAIN_PROVIDERS'
      INDRA_CONTRACT_ADDRESSES: '$INDRA_CONTRACT_ADDRESSES'
      INDRA_MNEMONIC_FILE: '$INDRA_MNEMONIC_FILE'
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
      INDRA_PORT: '8080'
      INDRA_REDIS_URL: '$redis_url'
      NODE_ENV: '`
        if [[ "$INDRA_ENV" == "prod" ]]; then echo "production"; else echo "development"; fi
      `'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'
    networks:
      - '$project'
    secrets:
      - '$db_secret'
      - '$mnemonic_secret_name'

  database:
    image: '$database_image'
    deploy:
      mode: 'global'
    environment:
      AWS_ACCESS_KEY_ID: '$INDRA_AWS_ACCESS_KEY_ID'
      AWS_SECRET_ACCESS_KEY: '$INDRA_AWS_SECRET_ACCESS_KEY'
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
      - '$snapshots_dir:/root/snapshots'
    networks:
      - '$project'

  nats:
    image: '$nats_image'
    command: '-D -V'
    environment:
      JWT_SIGNER_PUBLIC_KEY: '$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'
    networks:
      - '$project'

  redis:
    image: '$redis_image'
    networks:
      - '$project'

  logdna:
    image: '$logdna_image'
    environment:
      LOGDNA_KEY: '$INDRA_LOGDNA_KEY'
    volumes:
      - '/var/run/docker.sock:/var/run/docker.sock'
    networks:
      - '$project'

EOF

docker stack deploy -c $root/docker-compose.yml $project

echo "The $project stack has been deployed, waiting for the proxy to start responding.."
timeout=$(expr `date +%s` + 30)
while true
do
  res="`curl -m 5 -s $proxy_url || true`"
  if [[ -z "$res" || "$res" == "Waiting for Indra to wake up" ]]
  then
    if [[ "`date +%s`" -gt "$timeout" ]]
    then echo "Timed out waiting for proxy to respond.." && exit
    else sleep 2
    fi
  else echo "Good Morning!" && exit;
  fi
done

