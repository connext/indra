#!/bin/bash
set -e

test_command='jest'

watch_command='
  function hash {
    find src -type f -not -name "*.swp" -exec stat {} \; \
     | grep "Modify:" \
     | sha256sum
  }

  echo "Triggering first compilation/test cycle..."
  while true
  do
    if [[ "$srcHash" == "`hash`" ]]
    then sleep 1 && continue
    else srcHash="`hash`" && echo "Changes detected, compiling..."
    fi

    tsc --project tsconfig.json

    if [[ "$?" != "0" ]]
    then echo "Compilation failed, waiting for changes..." && sleep 1 && continue
    else echo "Compiled successfully, running test suite"
    fi

    jest

    echo "Waiting for changes..."

  done
'

project="indra_v2"

if [[ "$1" == "--watch" ]]
then
  suffix="node_watcher"
  command="$watch_command"
else
  suffix="node_tester"
  command="$test_command"
fi

eth_address="0x627306090abaB3A6e1400e9345bC60c78a8BEf57"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
log_level="3" # set to 0 for no logs or to 5 for all the logs
network="${project}_$suffix"

postgres_db="${project}_$suffix"
postgres_host="${project}_database_$suffix"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"
database_url="postgresql://$postgres_user:$postgres_password@$postgres_host:$postgres_port/$postgres_db"

nats_host="${project}_nats_$suffix"

node_port="8080"
node_host="${project}_$suffix"

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $postgres_host 2> /dev/null || true
  docker container stop $nats_host 2> /dev/null || true
  docker container stop $node_host 2> /dev/null || true
}
trap cleanup EXIT

docker network create --attachable $network 2> /dev/null || true

########################################
# Start dependencies

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
  --detach \
  --name="$nats_host" \
  --network="$network" \
  --rm \
  nats:2.0.0-linux

########################################
# Run Tests

echo "Starting $node_host.."
docker run \
  --entrypoint="bash" \
  --env="INDRA_NATS_CLUSTER_ID=" \
  --env="INDRA_NATS_SERVERS=nats://$nats_host:4222" \
  --env="INDRA_NATS_TOKEN" \
  --env="INDRA_PG_DATABASE=$postgres_db" \
  --env="INDRA_PG_HOST=$postgres_host" \
  --env="INDRA_PG_PASSWORD=$postgres_password" \
  --env="INDRA_PG_PORT=$postgres_port" \
  --env="INDRA_PG_USERNAME=$postgres_user" \
  --env="LOG_LEVEL=$log_level" \
  --env="NODE_ENV=development" \
  --env="NODE_MNEMONIC=$eth_mnemonic" \
  --env="PORT=$node_port" \
  --env="SIGNER_ADDRESS=$eth_address" \
  --name="$node_host" \
  --network="$network" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    echo "Node Tester Container launched!";echo

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
