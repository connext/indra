#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# Deploy with an attachable network so tests & the daicard can connect to individual components
# Delete/recreate the network first to delay docker network slowdowns that have been happening
docker network rm $project 2> /dev/null || true
docker network create --attachable --driver overlay $project 2> /dev/null || true

####################
# Load env vars

if [[ -f "dev.env" ]]
then source dev.env
fi

if [[ -f ".env" ]]
then source .env
fi

# alias env var
INDRA_LOG_LEVEL="$LOG_LEVEL";

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

nats_port=4222
node_port=8080
dash_port=9999

proxy_url="http://localhost:3000"

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
  webserver_url="localhost:80"
else
  if [[ "$INDRA_UI" == "dashboard" ]]
  then webserver_working_dir=/root/modules/dashboard
  elif [[ "$INDRA_UI" == "daicard" ]]
  then webserver_working_dir=/root/modules/daicard
  else
    echo "INDRA_UI: Expected headless, dashboard, or daicard"
    exit 1
  fi
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
      - '$root:/root'
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
bash ops/save-secret.sh "${project}_database_dev" "$project"

########################################
# Configure or launch Ethereum testnets

eth_mnemonic="${INDRA_MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"

# If no chain providers provided, spin up local testnets & use those
if [[ -z "$INDRA_CHAIN_PROVIDERS" ]]
then
  chain_id_1=1337; chain_id_2=1338;
  INDRA_MNEMONIC="$eth_mnemonic" bash ops/start-testnet.sh $chain_id_1 $chain_id_2
  chain_providers="`cat $root/.chaindata/providers/${chain_id_1}-${chain_id_2}.json`"
  contract_addresses="`cat $root/.chaindata/addresses/${chain_id_1}-${chain_id_2}.json`"
  chain_url_1="`echo $chain_providers | tr -d "'" | jq '.[]' | head -n 1 | tr -d '"'`"

# If chain providers are provided, use those
else
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
      ETH_PROVIDER_URL: '$chain_url_1'
      MESSAGING_TCP_URL: 'nats:4222'
      MESSAGING_WS_URL: 'nats:4221'
      NODE_URL: 'node:8080'
      WEBSERVER_URL: '$webserver_url'
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
      INDRA_CHAIN_PROVIDERS: '$chain_providers'
      INDRA_CONTRACT_ADDRESSES: '$contract_addresses'
      INDRA_MNEMONIC: '$eth_mnemonic'
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
      - '$root:/root'

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
