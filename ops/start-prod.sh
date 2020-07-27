#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Deploy with an attachable network in test-mode
# Delete/recreate the network first to delay docker network slowdowns that have been happening
docker network rm $project 2> /dev/null || true
docker network create --attachable --driver overlay $project 2> /dev/null || true

####################
# Load env vars

mode_override="$INDRA_MODE"

if [[ -f "prod.env" ]]
then source prod.env
fi

if [[ -f ".env" ]]
then source .env
fi

INDRA_MODE=${mode_override}

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
  echo "export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=\"$pubKey\"" >> .env
  echo "export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=\"$prvKey\"" >> .env
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

proxy_url="http://localhost:80"

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
then version="`cat $root/package.json | grep '"version":' | head -n 1 | cut -d '"' -f 4`"
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

  chain_id_1=1337; chain_id_2=1338;
  INDRA_CHAIN_MODE="${INDRA_MODE#test-}" bash ops/start-testnet.sh $chain_id_1 $chain_id_2
  chain_providers="`cat $root/.chaindata/providers/${chain_id_1}-${chain_id_2}.json`"
  contract_addresses="`cat $root/.chaindata/addresses/${chain_id_1}-${chain_id_2}.json`"
  chain_url_1="`echo $chain_providers | tr -d "'" | jq '.[]' | head -n 1 | tr -d '"'`"

# If chain providers are provided, use those
else
  echo "Using chain providers:" $INDRA_CHAIN_PROVIDERS
  eval chain_providers="$INDRA_CHAIN_PROVIDERS"
  chain_url_1="`echo $chain_providers | tr -d "'" | jq '.[]' | head -n 1 | tr -d '"'`"
  # Prefer top-level address-book override otherwise default to one in contracts
  if [[ -f address-book.json ]]
  then contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
  else contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
  fi
fi

####################
# Launch Indra stack

echo "Deploying $node_image to $INDRA_DOMAINNAME"

mkdir -p $root/ops/database/snapshots
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
      ETH_PROVIDER_URL: '$chain_url_1'
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
      INDRA_CONTRACT_ADDRESSES: '$contract_addresses'
      INDRA_MNEMONIC_FILE: '/run/secrets/$eth_mnemonic_name'
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
      - '$root/ops/database/snapshots:/root/snapshots'
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
