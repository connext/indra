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
then 
  pisa_url="https://connext-rinkeby.pisa.watch/"
  eth_rpc_url="https://rinkeby.infura.io/metamask"
elif [[ "$ETH_NETWORK" == "kovan" ]]
then eth_rpc_url="https://kovan.infura.io/metamask"
elif [[ "$ETH_NETWORK" == "ganache" ]]
then
  pisa_url="http://pisa:5487"
  eth_rpc_url="http://ethprovider:8545"
  make deployed-contracts
fi

eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

# database connection settings
pg_db="$project"
pg_password_file="/run/secrets/${project}_database_dev"
pg_host="database"
pg_port="5432"
pg_user="$project"

# docker images
builder_image="${project}_builder"
daicard_devserver_image="$builder_image"
database_image="postgres:9-alpine"
ethprovider_image="trufflesuite/ganache-cli:v6.4.5"
hasura_image="hasura/graphql-engine:latest"
nats_image="nats:2.0.0-linux"
node_image="$builder_image"
proxy_image="${project}_proxy:dev"
redis_image=redis:5-alpine
redis_url="redis://redis:6379"
relay_image="${project}_relay"
pisa_image="pisaresearch/pisa:v0.1.4-connext-beta.0"

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
pull_if_unavailable "$ethprovider_image"
pull_if_unavailable "$hasura_image"
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

number_of_services=10 # NOTE: Gotta update this manually when adding/removing services :(

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
      HASURA_URL: http://hasura:8080
      MODE: dev
      PISA_URL: $pisa_url
    networks:
      - $project
    ports:
      - "80:80"
    volumes:
      - certs:/etc/letsencrypt
  
  pisa:
    image: $pisa_image
    ports:
      - "5487:3000"
    entrypoint: >-
      node ./build/src/startUp.js 
      --json-rpc-url $eth_rpc_url 
      --host-name 0.0.0.0 
      --host-port 3000 
      --responder-key 0x388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418 
      --receipt-key 0x388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418
      --db-dir ./db
      --loglevel info
      --pisa-contract-address 0x0000000000000000000000000000000000000000 
      --instance-name connext-test
      --rate-limit-user-window-ms 1000
      --rate-limit-user-max 100
      --rate-limit-global-window-ms 1000
      --rate-limit-global-max 100
    networks:
      - $project

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
    command: ["--db=/data", "--mnemonic=$eth_mnemonic", "--networkId=4447", "--blockTime=15"]
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

  hasura:
    image: $hasura_image
    environment:
      HASURA_GRAPHQL_DATABASE_URL: "postgres://$pg_user:$pg_user@$pg_host:$pg_port/$project"
      HASURA_GRAPHQL_ENABLE_CONSOLE: "true"
    networks:
      - $project
    ports:
      - "8083:8080"

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
