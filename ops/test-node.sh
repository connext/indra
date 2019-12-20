#!/usr/bin/env bash
set -e

test_command='
  jest --config ops/jest.config.json '"$@"'
'

watch_command='
  exec jest --config ops/jest.config.json --watch '"$@"'
'

project="indra"

if [[ "$1" == "--watch" ]]
then
  suffix="node_watcher"
  command="$watch_command"
  shift # forget $1 and replace it w $2, etc
else
  suffix="node_tester"
  command="$test_command"
fi

####################
# Internal Config
# config & hard-coded stuff you might want to change

log_level="3" # set to 0 for no logs or to 5 for all the logs
network="${project}_$suffix"

eth_network="ganache"

ethprovider_host="${project}_ethprovider_$suffix"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
eth_rpc_url="http://$ethprovider_host:8545"

postgres_db="${project}_$suffix"
postgres_host="${project}_database_$suffix"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"

nats_host="${project}_nats_$suffix"

redis_host="${project}_redis_$suffix"

node_port="8080"
node_host="${project}_$suffix"

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $ethprovider_host 2> /dev/null || true
  docker container stop $postgres_host 2> /dev/null || true
  docker container stop $nats_host 2> /dev/null || true
  docker container stop $node_host 2> /dev/null || true
}
trap cleanup EXIT

docker network create --attachable $network 2> /dev/null || true

# Damn I forget where I copy/pasted this witchcraft from, yikes.
# It's supposed to find out whether we're calling this script from a shell & can print stuff
# Or whether it's running in the background of another script and can't attach to a screen
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

########################################
# Start dependencies

echo "Node tester activated!";echo;

echo "Starting $ethprovider_host.."
docker run \
  --detach \
  --name="$ethprovider_host" \
  --network="$network" \
  --rm \
  --tmpfs="/data" \
  trufflesuite/ganache-cli:v6.4.3 \
    --db="/data" \
    --mnemonic="$eth_mnemonic" \
    --networkId="4447"

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
  --detach \
  --name="$nats_host" \
  --network="$network" \
  --rm \
  nats:2.0.0-linux

echo "Starting $redis_host.."
docker run \
  --detach \
  --name="$redis_host" \
  --network="$network" \
  --rm \
  redis:5-alpine

########################################
# Run Tests

echo "Starting $node_host.."
docker run \
  --entrypoint="bash" \
  --env="INDRA_ETH_CONTRACT_ADDRESSES=$eth_contract_addresses" \
  --env="INDRA_ETH_MNEMONIC=$eth_mnemonic" \
  --env="INDRA_ETH_RPC_URL=$eth_rpc_url" \
  --env="INDRA_LOG_LEVEL=$log_level" \
  --env="INDRA_NATS_CLUSTER_ID=" \
  --env="INDRA_NATS_SERVERS=nats://$nats_host:4222" \
  --env="INDRA_NATS_TOKEN" \
  --env="INDRA_PG_DATABASE=$postgres_db" \
  --env="INDRA_PG_HOST=$postgres_host" \
  --env="INDRA_PG_PASSWORD=$postgres_password" \
  --env="INDRA_PG_PORT=$postgres_port" \
  --env="INDRA_PG_USERNAME=$postgres_user" \
  --env="INDRA_PORT=$node_port" \
  --env="INDRA_REDIS_URL=redis://$redis_url:6379" \
  --env="NODE_ENV=development" \
  $interactive \
  --name="$node_host" \
  --network="$network" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    echo "Node Tester Container launched!";echo

    echo "Waiting for ${INDRA_ETH_RPC_URL#*://}..."
    bash ops/wait-for.sh -t 60 ${INDRA_ETH_RPC_URL#*://} 2> /dev/null
    echo "Waiting for $INDRA_PG_HOST:$INDRA_PG_PORT..."
    bash ops/wait-for.sh -t 60 $INDRA_PG_HOST:$INDRA_PG_PORT 2> /dev/null
    echo "Waiting for ${INDRA_NATS_SERVERS#*://}..."
    bash ops/wait-for.sh -t 60 ${INDRA_NATS_SERVERS#*://} 2> /dev/null
    echo

    cd modules/node
    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "Node tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    '"$command"'

  '
