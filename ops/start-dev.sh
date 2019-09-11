#!/usr/bin/env bash
set -e

project="indra"

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

####################
# External Env Vars

ETH_NETWORK="${1:-kovan}"

####################
# Internal Config
# config & hard-coded stuff you might want to change

log_level=3

if [[ "$ETH_NETWORK" == "rinkeby" ]]
then eth_rpc_url="https://rinkeby.infura.io/metamask"
elif [[ "$ETH_NETWORK" == "kovan" ]]
then eth_rpc_url="https://kovan.infura.io/metamask"
elif [[ "$ETH_NETWORK" == "ganache" ]]
then
  eth_rpc_url="http://ethprovider:8545"
  make deployed-contracts
fi

eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

# database connection settings
postgres_db="$project"
postgres_password_file="/run/secrets/${project}_database_dev"
postgres_host="database"
postgres_port="5432"
postgres_user="$project"

# docker images
builder_image="${project}_builder"
database_image="postgres:9-alpine"
ethprovider_image="trufflesuite/ganache-cli:v6.4.5"
node_image="$builder_image"
nats_image="nats:2.0.0-linux"
proxy_image="${project}_proxy:dev"
daicard_devserver_image="$builder_image"
relay_image="${project}_relay"
redis_image=redis:5-alpine
redis_url="redis://redis:6379"
webdis_image="anapsix/webdis"

node_port=8080
nats_port=4222

####################
# Deploy according to above configuration

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then docker pull $1
  fi
}
pull_if_unavailable "$database_image"
pull_if_unavailable "$nats_image"
pull_if_unavailable "$ethprovider_image"

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

number_of_services=9 # NOTE: Gotta update this manually when adding/removing services :(

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
  proxy:
    image: $proxy_image
    environment:
      DAICARD_URL: http://daicard:3000
      ETH_RPC_URL: $eth_rpc_url
      MESSAGING_URL: http://relay:4223
      MODE: dev
    networks:
      - $project
    ports:
      - "80:80"
    volumes:
      - certs:/etc/letsencrypt

  daicard:
    image: $daicard_devserver_image
    entrypoint: npm start
    environment:
      NODE_ENV: development
    networks:
      - $project
    volumes:
      - `pwd`:/root
    working_dir: /root/modules/daicard

  relay:
    image: $relay_image
    command: ["nats:$nats_port"]
    networks:
      - $project
    ports:
      - "4223:4223"

  node:
    image: $node_image
    entrypoint: bash modules/node/ops/entry.sh
    environment:
      INDRA_ETH_CONTRACT_ADDRESSES: '$eth_contract_addresses'
      INDRA_ETH_MNEMONIC: $eth_mnemonic
      INDRA_ETH_RPC_URL: $eth_rpc_url
      INDRA_LOG_LEVEL: $log_level
      INDRA_NATS_CLUSTER_ID:
      INDRA_NATS_SERVERS: nats://nats:$nats_port
      INDRA_NATS_TOKEN:
      INDRA_PG_DATABASE: $postgres_db
      INDRA_PG_HOST: $postgres_host
      INDRA_PG_PASSWORD_FILE: $postgres_password_file
      INDRA_PG_PORT: $postgres_port
      INDRA_PG_USERNAME: $postgres_user
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
    command: ["--db=/data", "--mnemonic=$eth_mnemonic", "--networkId=4447"]
    networks:
      - $project
    ports:
      - "8545:8545"
    volumes:
      - chain_dev:/data

  database:
    image: $database_image
    deploy:
      mode: global
    environment:
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $postgres_password_file
      POSTGRES_USER: $project
    networks:
      - $project
    ports:
      - "5432:5432"
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

  webdis:
    image: $webdis_image
    ports:
      - "7379:7379"
    depends_on:
      - "redis"

  redis:
    image: $redis_image
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
