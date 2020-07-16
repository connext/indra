#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

tag="node_tester"
cmd="${1:-test}"
shift || true # $1 is the command to npm run. Extra options, if any, come after

source $root/dev.env

mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

####################
# Internal Config
# config & hard-coded stuff you might want to change

chain_id_1=1339
chain_id_2=1340

chain_url_1="http://172.17.0.1:$chain_port_1"
chain_url_2="http://172.17.0.1:$chain_port_2"

chain_host_1="${project}_testnet_$chain_id_1"
chain_host_2="${project}_testnet_$chain_id_2"
chain_providers='{"'$chain_id_1'":"'$chain_url_1'","'$chain_id_2'":"'$chain_url_2'"}'
nats_host="${project}_nats_$tag"
network="${project}_$tag"
node_host="${project}_$tag"
node_port="8080"
postgres_db="${project}_$tag"
postgres_host="${project}_database_$tag"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"
redis_host="${project}_redis_$tag"

docker network create --attachable $network 2> /dev/null || true

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

########################################
# Start dependencies

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $chain_host_1 2> /dev/null || true
  docker container stop $chain_host_2 2> /dev/null || true
  docker container stop $postgres_host 2> /dev/null || true
  docker container stop $nats_host 2> /dev/null || true
  docker container stop $redis_host 2> /dev/null || true
  docker container stop $node_host 2> /dev/null || true
}
trap cleanup EXIT

echo "Node tester activated!";echo;

echo "Starting $postgres_host.."
docker run \
  --detach \
  --env="POSTGRES_DB=$postgres_db" \
  --env="POSTGRES_PASSWORD=$postgres_password" \
  --env="POSTGRES_USER=$postgres_user" \
  --name="$postgres_host" \
  --network="$network" \
  --rm \
  --tmpfs="/var/lib/postgresql/data" \
  postgres:9-alpine

echo "Starting $nats_host.."
docker run \
  --env="JWT_SIGNER_PUBLIC_KEY=$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY" \
  --detach \
  --name="$nats_host" \
  --network="$network" \
  --rm \
  provide/nats-server:latest

echo "Starting $redis_host.."
docker run \
  --detach \
  --name="$redis_host" \
  --network="$network" \
  --rm \
  redis:5-alpine

export INDRA_CHAIN_ID_1=$chain_id_1
export INDRA_CHAIN_ID_2=$chain_id_2
bash ops/start-testnet.sh

# Merge relevant address books
eth_contract_addresses=`cat \
  $root/.chaindata/$chain_id_1/address-book.json \
  $root/.chaindata/$chain_id_2/address-book.json \
  | jq -s '.[0] * .[1]'
`

########################################
# Run Tests

echo "Starting $node_host.."
docker run \
  --entrypoint="bash" \
  --env="INDRA_ADMIN_TOKEN=$INDRA_ADMIN_TOKEN" \
  --env="INDRA_CHAIN_PROVIDERS=$chain_providers" \
  --env="INDRA_ETH_CONTRACT_ADDRESSES=$eth_contract_addresses" \
  --env="INDRA_ETH_MNEMONIC=$mnemonic" \
  --env="INDRA_LOG_LEVEL=${INDRA_LOG_LEVEL:-0}" \
  --env="INDRA_NATS_CLUSTER_ID=" \
  --env="INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=$INDRA_NATS_JWT_SIGNER_PRIVATE_KEY" \
  --env="INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY" \
  --env="INDRA_NATS_SERVERS=nats://$nats_host:4222" \
  --env="INDRA_NATS_WS_ENDPOINT=wss://$nats_host:4221" \
  --env="INDRA_PG_DATABASE=$postgres_db" \
  --env="INDRA_PG_HOST=$postgres_host" \
  --env="INDRA_PG_PASSWORD=$postgres_password" \
  --env="INDRA_PG_PORT=$postgres_port" \
  --env="INDRA_PG_USERNAME=$postgres_user" \
  --env="INDRA_PORT=$node_port" \
  --env="INDRA_REDIS_URL=redis://$redis_host:6379" \
  --env="LOG_LEVEL=${LOG_LEVEL:-0}" \
  --env="NODE_ENV=development" \
  $interactive \
  --name="$node_host" \
  --network="$network" \
  --rm \
  --volume="$root:/root" \
  ${project}_builder -c '
    echo "Node Tester Container launched!";echo
    shopt -s globstar
    cd modules/node
    npm run '"$cmd"' -- '"$@"'
  '
