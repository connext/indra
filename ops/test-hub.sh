#!/bin/bash
set -e

test_command='
  ./node_modules/.bin/mocha \
    -r ts-node/register/type-check \
    -r ./src/register/common.ts \
    -r ./src/register/testing.ts \
    "src/**/*.test.ts" --exit
'

watch_command='
  function hash {
    find src /client/dist -type f -not -name "*.swp" -exec stat {} \; \
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

    tsc

    if [[ "$?" != "0" ]]
    then echo "Compilation failed, waiting for changes..." && sleep 1 && continue
    else echo "Compiled successfully, running test suite"
    fi

    ./node_modules/.bin/mocha \
      -r ./dist/register/common.js \
      "dist/**/*.test.js" --exit

    echo "Waiting for changes..."

  done
'

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"
root=`pwd | sed 's/indra.*/indra/'`
if [[ "$1" == "--watch" ]]
then
  suffix="hub_watcher"
  command="$watch_command"
else
  date "+%s" > /tmp/timestamp
  suffix="hub_tester"
  command="$test_command"
fi

NETWORK="${project}_$suffix"

POSTGRES_DB="${project}_$suffix"
POSTGRES_HOST="${project}_database_$suffix"
POSTGRES_PASSWORD="$project"
POSTGRES_USER="$project"
DATABASE="$POSTGRES_HOST:5432"
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$DATABASE/$POSTGRES_DB"

REDIS_HOST="${project}_redis_$suffix"
REDIS="$REDIS_HOST:6379"
REDIS_URL="redis://$REDIS"

ETHPROVIDER_HOST="${project}_ethprovider_$suffix"
ETH_RPC_URL="$ETHPROVIDER_HOST:8545"
ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

HUB_HOST="${project}_$suffix"

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $REDIS_HOST 2> /dev/null || true
  docker container stop $ETHPROVIDER_HOST 2> /dev/null || true
  docker container stop $POSTGRES_HOST 2> /dev/null || true
  docker container stop $HUB_HOST 2> /dev/null || true
  if [[ "$suffix" == "hub_tester" ]]
  then echo;echo "Testing hub complete in $((`date "+%s"` - `cat /tmp/timestamp`)) seconds!"
  fi
}
trap cleanup EXIT

docker network create --attachable $NETWORK 2> /dev/null || true

########################################
# Start dependencies

echo "Hub tester activated!";echo;

echo "Starting $REDIS_HOST..."
docker run \
  --detach \
  --name="$REDIS_HOST" \
  --network="$NETWORK" \
  --rm \
  redis:5-alpine

echo "Starting $POSTGRES_HOST.."
docker run \
  --detach \
  --env="POSTGRES_DB=$POSTGRES_DB" \
  --env="POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
  --env="POSTGRES_USER=$POSTGRES_USER" \
  --name="$POSTGRES_HOST" \
  --network="$NETWORK" \
  --rm \
  --tmpfs="/var/lib/postgresql/data" \
  ${project}_database:dev

echo "Starting $ETHPROVIDER_HOST.."
docker run \
  --detach \
  --entrypoint="bash" \
  --env="ETH_MNEMONIC=$ETH_MNEMONIC" \
  --env="ETH_NETWORK=ganache" \
  --env="ETH_PROVIDER=http://$ETH_RPC_URL" \
  --name="$ETHPROVIDER_HOST" \
  --network="$NETWORK" \
  --rm \
  --volume="$root/modules/contracts:/root" \
  --tmpfs="/data" \
  ${project}_builder ops/entry.sh

########################################
# Run Tests

echo "Starting $HUB_HOST.."
docker run \
  --entrypoint="bash" \
  --env="DATABASE=$DATABASE" \
  --env="DATABASE_URL_TEST=$DATABASE_URL" \
  --env="ETH_RPC_URL_TEST=$ETH_RPC_URL" \
  --env="ETHPROVIDER_HOST=$ETHPROVIDER_HOST" \
  --env="POSTGRES_DB=$POSTGRES_DB" \
  --env="POSTGRES_HOST=$POSTGRES_HOST" \
  --env="POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
  --env="POSTGRES_USER=$POSTGRES_USER" \
  --env="REDIS=$REDIS" \
  --env="REDIS_HOST=$REDIS_HOST" \
  --env="REDIS_URL_TEST=$REDIS_URL" \
  --name="$HUB_HOST" \
  --network="$NETWORK" \
  --rm \
  --tty \
  --volume="$root/modules/client:/client" \
  --volume="$root/modules/hub:/root" \
  ${project}_builder -c '
    PATH=./node_modules/.bin:$PATH
    echo "Hub Tester Container launched!";echo

    echo "Waiting for $REDIS..." && bash ops/wait-for.sh -t 60 $REDIS 2> /dev/null
    echo "Waiting for $POSTGRES_HOST:5431..." && bash ops/wait-for.sh -t 60 $POSTGRES_HOST:5431 2> /dev/null
    echo "Waiting for $DATABASE..." && bash ops/wait-for.sh -t 60 $DATABASE 2> /dev/null
    echo "Waiting for $ETH_RPC_URL_TEST..." && bash ops/wait-for.sh -t 60 $ETH_RPC_URL_TEST 2> /dev/null
    echo

    function finish {
      echo && echo "Hub tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    '"$command"'

  '
