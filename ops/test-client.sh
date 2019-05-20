#!/usr/bin/env bash
set -e

test_command='
  set -e
  echo "Compiling..."
  tsc
  echo "Compiled successfully, running test suite..."

  ./node_modules/.bin/mocha \
    -r ./dist/register/common.js \
    "dist/**/*.test.js" --exit
'

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
    else echo "Changes detected, compiling..." && srcHash="`hash`"
    fi

    rm -rf dist/* types/*
    tsc

    if [[ "$?" != "0" ]] # skip tests if compilation failed
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
  suffix="client_watcher"
  command="$watch_command"
else
  date "+%s" > /tmp/timestamp
  suffix="client_tester"
  command="$test_command"
fi

NETWORK="${project}_$suffix"

ETHPROVIDER_HOST="${project}_ethprovider_$suffix"
ETH_RPC_URL="http://$ETHPROVIDER_HOST:8545"
ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

CLIENT_HOST="${project}_$suffix"

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $ETHPROVIDER_HOST 2> /dev/null || true
  docker container stop $CLIENT_HOST 2> /dev/null || true
  if [[ "$suffix" == "client_tester" ]]
  then echo;echo "Testing client complete in $((`date "+%s"` - `cat /tmp/timestamp`)) seconds!"
  fi
}
trap cleanup EXIT

docker network create --attachable $NETWORK 2> /dev/null || true

########################################
# Start dependencies

echo "Client tester activated!";echo;

echo "Starting $ETHPROVIDER_HOST.."
docker run \
  --detach \
  --entrypoint="bash" \
  --env="ETH_MNEMONIC=$ETH_MNEMONIC" \
  --env="ETH_NETWORK=ganache" \
  --name="$ETHPROVIDER_HOST" \
  --network="$NETWORK" \
  --rm \
  --volume="$root/modules/contracts:/root" \
  --tmpfs="/data" \
  ${project}_builder ops/entry.sh signal nomigrate

########################################
# Run Tests

echo "Starting $CLIENT_HOST.."
docker run \
  --entrypoint="bash" \
  --env="ETH_RPC_URL=$ETH_RPC_URL" \
  --interactive \
  --name="$CLIENT_HOST" \
  --network="$NETWORK" \
  --rm \
  --tty \
  --volume=$root/modules/client:/root \
  ${project}_builder -c '
    PATH=./node_modules/.bin:$PATH
    echo "Client Tester Container launched!";echo

    function finish {
      echo && echo "Client tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    '"$command"'

  '
