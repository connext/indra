#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"
tmp="$root/.tmp"; mkdir -p $tmp

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# make sure a network for this project has been created
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

# log level alias can override default for easy `LOG_LEVEL=5 make start`
INDRA_LOG_LEVEL="${LOG_LEVEL:-$INDRA_LOG_LEVEL}";

########################################
## Docker registry & image version config

# prod version: if we're on a tagged commit then use the tagged semvar, otherwise use the hash
if [[ "$INDRA_ENV" == "prod" ]]
then
  git_tag="`git tag --points-at HEAD | grep "indra-" | head -n 1`"
  if [[ -n "$git_tag" ]]
  then version="`echo $git_tag | sed 's/indra-//'`"
  else version="`git rev-parse HEAD | head -c 8`"
  fi
else version="latest"
fi

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then
    if [[ -n "`echo $1 | grep "${project}_"`" ]]
    then full_name="${registry%/}/$1"
    else full_name="$1"
    fi
    echo "Can't find image $1 locally, attempting to pull $full_name"
    docker pull $full_name
    docker tag $full_name $1
  fi
}

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

echo "Using docker images ${project}_name:${version} "

####################
# Misc Config

builder_image="${project}_builder"

redis_image="redis:5-alpine";
pull_if_unavailable "$redis_image"

# to access from other containers
redis_url="redis://redis:6379"

common="networks:
      - '$project'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'"

####################
# Proxy config

proxy_image="${project}_proxy:$version";
pull_if_unavailable "$proxy_image"

if [[ -z "$INDRA_DOMAINNAME" ]]
then
  public_url="http://localhost:3000"
  proxy_ports="ports:
      - '3000:80'
      - '4221:4221'
      - '4222:4222'"
else
  public_url="https://localhost:443"
  proxy_ports="ports:
      - '80:80'
      - '443:443'
      - '4221:4221'
      - '4222:4222'"
fi

echo "Proxy configured"

########################################
## Node config

node_port="8888"

if [[ $INDRA_ENV == "prod" ]]
then
  node_image_name="${project}_node:$version"
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

database_image="${project}_database:$version";
pull_if_unavailable "$database_image"

snapshots_dir="$root/.db-snapshots"
mkdir -p $snapshots_dir

if [[ "$INDRA_ENV" == "prod" ]]
then
  database_image="image: '$database_image'"
  db_volume="database"
  db_secret="${project}_database"
  new_secret $db_secret
else
  database_image="image: '$database_image'
    ports:
      - '5432:5432'"
  db_volume="database_dev"
  db_secret="${project}_database_dev"
  new_secret "$db_secret" "$project"
fi

# database connection settings
pg_db="$project"
pg_host="database"
pg_password_file="/run/secrets/$db_secret"
pg_port="5432"
pg_user="$project"

echo "Database configured"

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
# Chain provider config

# If no chain providers provided, spin up local testnets & use those
if [[ -z "$INDRA_CHAIN_PROVIDERS" ]]
then
  mnemonic_secret_name="${project}_mnemonic_dev"
  echo 'No $INDRA_CHAIN_PROVIDERS provided, spinning up local testnets & using those.'
  eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  bash ops/save-secret.sh "$mnemonic_secret_name" "$eth_mnemonic"
  pull_if_unavailable "${project}_ethprovider:$version"
  chain_id_1=1337; chain_id_2=1338;
  bash ops/start-testnet.sh $chain_id_1 $chain_id_2
  INDRA_CHAIN_PROVIDERS="`cat $root/.chaindata/providers/${chain_id_1}-${chain_id_2}.json`"
  INDRA_CONTRACT_ADDRESSES="`cat $root/.chaindata/addresses/${chain_id_1}-${chain_id_2}.json`"

# If chain providers are provided, use those
else
  mnemonic_secret_name="${project}_mnemonic"
  echo "Using chain providers:" $INDRA_CHAIN_PROVIDERS
  # Prefer top-level address-book override otherwise default to one in contracts
  if [[ -f address-book.json ]]
  then INDRA_CONTRACT_ADDRESSES="`cat address-book.json | tr -d ' \n\r'`"
  else INDRA_CONTRACT_ADDRESSES="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
  fi
fi

INDRA_MNEMONIC_FILE="/run/secrets/$mnemonic_secret_name"
ETH_PROVIDER_URL="`echo $INDRA_CHAIN_PROVIDERS | tr -d "'" | jq '.[]' | head -n 1 | tr -d '"'`"

# TODO: filter out extra contract addresses that we don't have any chain providers for?

echo "Chain providers configured"

####################
# Observability tools config

LOGDNA_TAGS="indra-${INDRA_DOMAINNAME:-unknown}"

logdna_image="logdna/logspout:v1.2.0";
pull_if_unavailable "$logdna_image"

grafana_image="grafana/grafana:latest"
pull_if_unavailable "$grafana_image"

prometheus_image="prom/prometheus:latest"
pull_if_unavailable "$prometheus_image"

cadvisor_image="gcr.io/google-containers/cadvisor:latest"
pull_if_unavailable "$cadvisor_image"

prometheus_services="prometheus:
    image: $prometheus_image
    $common
    ports:
      - 9090:9090
    command:
      - --config.file=/etc/prometheus/prometheus.yml
    volumes:
      - $root/ops/prometheus.yml:/etc/prometheus/prometheus.yml:ro
  cadvisor:
    $common
    image: $cadvisor_image
    ports:
      - 8081:8080
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro"

grafana_service="grafana:
    image: '$grafana_image'
    $common
    networks:
      - '$project'
    ports:
      - '3002:3000'
    volumes:
      - 'grafana:/var/lib/grafana'"

logdna_service="logdna:
    $common
    image: '$logdna_image'
    environment:
      LOGDNA_KEY: '$INDRA_LOGDNA_KEY'
      TAGS: '$LOGDNA_TAGS'
    volumes:
      - '/var/run/docker.sock:/var/run/docker.sock'"

# TODO we probably want to remove observability from dev env once it's working
# bc these make indra take a log longer to wake up

if [[ "$INDRA_ENV" == "prod" ]]
then observability_services="$logdna_service
  $prometheus_services
  $grafana_service"
else observability_services="$prometheus_services
  $grafana_service"
fi

####################
# Launch Indra stack

echo "Launching ${project}"

rm -rf $root/docker-compose.yml $root/${project}.docker-compose.yml
cat - > $root/docker-compose.yml <<EOF
version: '3.4'

networks:
  $project:
    external: true

secrets:
  $db_secret:
    external: true
  $mnemonic_secret_name:
    external: true

volumes:
  grafana:
  certs:
  $db_volume:

services:

  proxy:
    $common
    $proxy_ports
    image: '$proxy_image'
    environment:
      INDRA_DOMAINNAME: '$INDRA_DOMAINNAME'
      INDRA_EMAIL: '$INDRA_EMAIL'
      INDRA_ETH_PROVIDER_URL: '$ETH_PROVIDER_URL'
      INDRA_MESSAGING_TCP_URL: 'nats:4222'
      INDRA_MESSAGING_WS_URL: 'nats:4221'
      INDRA_NODE_URL: 'node:$node_port'
    volumes:
      - 'certs:/etc/letsencrypt'

  node:
    $common
    $node_image
    environment:
      INDRA_ADMIN_TOKEN: '$INDRA_ADMIN_TOKEN'
      INDRA_ALLOWED_SWAPS: '$INDRA_ALLOWED_SWAPS'
      INDRA_SUPPORTED_TOKENS: '$INDRA_SUPPORTED_TOKENS'
      INDRA_CHAIN_PROVIDERS: '$INDRA_CHAIN_PROVIDERS'
      INDRA_CONTRACT_ADDRESSES: '$INDRA_CONTRACT_ADDRESSES'
      INDRA_DEFAULT_REBALANCE_PROFILE_ETH: '$INDRA_DEFAULT_REBALANCE_PROFILE_ETH'
      INDRA_DEFAULT_REBALANCE_PROFILE_TOKEN: '$INDRA_DEFAULT_REBALANCE_PROFILE_TOKEN'
      INDRA_LOG_LEVEL: '$INDRA_LOG_LEVEL'
      INDRA_MNEMONIC_FILE: '$INDRA_MNEMONIC_FILE'
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
      NODE_ENV: '`
        if [[ "$INDRA_ENV" == "prod" ]]; then echo "production"; else echo "development"; fi
      `'
    secrets:
      - '$db_secret'
      - '$mnemonic_secret_name'

  database:
    $common
    $database_image
    environment:
      AWS_ACCESS_KEY_ID: '$INDRA_AWS_ACCESS_KEY_ID'
      AWS_SECRET_ACCESS_KEY: '$INDRA_AWS_SECRET_ACCESS_KEY'
      INDRA_ADMIN_TOKEN: '$INDRA_ADMIN_TOKEN'
      INDRA_ENV: '$INDRA_ENV'
      POSTGRES_DB: '$project'
      POSTGRES_PASSWORD_FILE: '$pg_password_file'
      POSTGRES_USER: '$project'
    secrets:
      - '$db_secret'
    volumes:
      - '$db_volume:/var/lib/postgresql/data'
      - '$snapshots_dir:/root/snapshots'

  nats:
    $common
    image: '$nats_image'
    command: '-D -V'
    environment:
      JWT_SIGNER_PUBLIC_KEY: '$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY'

  redis:
    $common
    image: '$redis_image'

  $observability_services

EOF

docker stack deploy -c $root/docker-compose.yml $project

echo "The $project stack has been deployed, waiting for the proxy to start responding.."
timeout=$(expr `date +%s` + 60)
while true
do
  res="`curl -k -m 5 -s $public_url || true`"
  if [[ -z "$res" || "$res" == "Waiting for proxy to wake up" ]]
  then
    if [[ "`date +%s`" -gt "$timeout" ]]
    then echo "Timed out waiting for proxy to respond.." && exit
    else sleep 2
    fi
  else echo "Good Morning!" && exit;
  fi
done

