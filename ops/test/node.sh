#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

cmd="${1:-test}"
shift # $1 is the command to npm run. Extra options, if any, come after

tag="node_tester"

source dev.env

chain_id_1=1340
chain_port_1=8548
chain_url_1="http://172.17.0.1:$chain_port_1"
chain_tag_1="${chain_id_1}_$tag"

chain_id_2=1341
chain_port_2=8549
chain_url_2="http://172.17.0.1:$chain_port_2"
chain_tag_1="${chain_id_1}_$tag"

export INDRA_CHAIN_PROVIDERS='{"'$chain_id_1'":"'$chain_url_1'","'$chain_id_2'":"'$chain_url_2'"}'

####################
# Internal Config
# config & hard-coded stuff you might want to change

network="${project}_$tag"

ethprovider_1337_host="${project}_ethprovider_1337_$tag"
ethprovider_1338_host="${project}_ethprovider_1338_$tag"

eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
if [[ -f address-book.json ]]
then eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
else eth_contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
fi
eth_rpc_url_1337="http://$ethprovider_1337_host:8545"
eth_rpc_url_1338="http://$ethprovider_1338_host:8545"

postgres_db="${project}_$tag"
postgres_host="${project}_database_$tag"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"

nats_host="${project}_nats_$tag"

redis_host="${project}_redis_$tag"

node_port="8080"
node_host="${project}_$tag"

make deployed-contracts

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $ethprovider_1337_host 2> /dev/null || true
  docker container stop $ethprovider_1338_host 2> /dev/null || true
  docker container stop $postgres_host 2> /dev/null || true
  docker container stop $nats_host 2> /dev/null || true
  docker container stop $redis_host 2> /dev/null || true
  docker container stop $node_host 2> /dev/null || true
}
trap cleanup EXIT

docker network create --attachable $network 2> /dev/null || true

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

########################################
# Start dependencies
cwd="`pwd`"

echo "Node tester activated!";echo;

export INDRA_TESTNET_DATA_DIR=/tmpfs

echo "Starting $ethprovider_1337_host.."
docker run \
  --detach \
  --env="ETH_MENMONIC=$eth_mnemonic" \
  --name="$ethprovider_1337_host" \
  --network="$network" \
  --rm \
  --mount="type=bind,source=$cwd,target=/root" \
  --mount="type=volume,source=${project}_chain_1337,target=/data" \
  ${project}_builder -c "cd modules/contracts && bash ops/ganache.entry.sh start"

echo "Starting $ethprovider_1338_host.."
docker run \
  --detach \
  --env="ETH_MENMONIC=$eth_mnemonic" \
  --mount="type=bind,source=$cwd,target=/root" \
  --mount="type=volume,source=${project}_chain_1338,target=/data" \
  --name="$ethprovider_1338_host" \
  --network="$network" \
  --rm \
  ${project}_builder -c "cd modules/contracts && bash ops/buidler.entry.sh start"

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

########################################
# Run Tests

chain_providers='{"1337":"'$eth_rpc_url_1337'"}'

echo "Starting $node_host.."
docker run \
  --entrypoint="bash" \
  --env="INDRA_ADMIN_TOKEN=$INDRA_ADMIN_TOKEN" \
  --env="INDRA_CHAIN_PROVIDERS=$chain_providers" \
  --env="INDRA_ETH_CONTRACT_ADDRESSES=$eth_contract_addresses" \
  --env="INDRA_ETH_MNEMONIC=$eth_mnemonic" \
  --env="INDRA_ETH_RPC_URL=$eth_rpc_url_1337" \
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
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    echo "Node Tester Container launched!";echo
    shopt -s globstar

    echo "Waiting for ${INDRA_ETH_RPC_URL#*://}..."
    wait-for -t 60 ${INDRA_ETH_RPC_URL#*://} 2> /dev/null
    echo "Waiting for $INDRA_PG_HOST:$INDRA_PG_PORT..."
    wait-for -t 60 $INDRA_PG_HOST:$INDRA_PG_PORT 2> /dev/null
    echo "Waiting for ${INDRA_NATS_SERVERS#*://}..."
    wait-for -t 60 ${INDRA_NATS_SERVERS#*://} 2> /dev/null
    echo "Waiting for ${INDRA_REDIS_URL#*://}..."
    wait-for -t 60 ${INDRA_REDIS_URL#*://} 2> /dev/null
    echo

    cd modules/node
    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "Node tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    npm run '"$cmd"' -- '"$@"'
  '
