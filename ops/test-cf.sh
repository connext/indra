#!/usr/bin/env bash
set -e

project="indra"

test_command='
  jest --setupFiles dotenv-extended/config --runInBand --forceExit '"'$@'"'
'

watch_command='
  CI=true exec jest --color --setupFiles dotenv-extended/config --runInBand --watch '"$@"'
'

if [[ "$1" == "--watch" ]]
then
  suffix="cf_watcher"
  command="$watch_command"
  shift # forget $1 and replace it w $2, etc
else
  suffix="cf_tester"
  command="$test_command"
fi

####################
# Internal Config
# config & hard-coded stuff you might want to change

network="${project}_$suffix"

ethprovider_host="${project}_ethprovider_$suffix"
ethprovider_port="8545"
eth_rpc_url="http://$ethprovider_host:8545"

postgres_db="${project}_$suffix"
postgres_host="${project}_database_$suffix"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $ethprovider_host 2> /dev/null || true
  docker container stop $postgres_host 2> /dev/null || true
}
trap cleanup EXIT

docker network create --attachable $network 2> /dev/null || true

########################################
# Start dependencies

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

########################################
# Run Tests

docker run \
  --entrypoint="bash" \
  --env="GANACHE_HOST=$ethprovider_host" \
  --env="GANACHE_PORT=$ethprovider_port" \
  --env="POSTGRES_USER=$postgres_user" \
  --env="POSTGRES_HOST=$postgres_host" \
  --env="POSTGRES_DATABASE=$postgres_db" \
  --env="POSTGRES_PASSWORD=$postgres_password" \
  --env="POSTGRES_PORT=$postgres_port" \
  --env="POSTGRES_STORE_KEY=dev" \
  --interactive \
  --name="${project}_test_cf_core" \
  --network="$network" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "CF tester container launched!";echo
    cd modules/cf-core
    rm -rf .env
    env > .env
    export PATH=./node_modules/.bin:$PATH
    function finish {
      echo && echo "CF tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT
    '"$command"'
  '
