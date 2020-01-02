#!/usr/bin/env bash
set -e

test_command='
  ./node_modules/.bin/jest --config jest.config.js --forceExit '"$@"'
'

watch_command='
  exec ./node_modules/.bin/jest --config jest.config.js --watch '"$@"'
'

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | jq .name | tr -d '"'`"
cwd="`pwd`"

if [[ "$1" == "--watch" ]]
then
  suffix="integration_watcher"
  command="$watch_command"
  shift # forget $1 and replace it w $2, etc
else
  suffix="integration_tester"
  command="$test_command"
fi

####################
# Internal Config
# config & hard-coded stuff you might want to change

log_level="3" # set to 0 for no logs or to 5 for all the logs
network="${project}_$suffix"

# TODO: how do we know if we're in prod mode or not?
if [[ "$INDRA_TEST_MODE" == "prod" ]]
then 
  echo "Running in prod test mode"
fi

eth_network="ganache"

test_runner_host="${project}_$suffix"

NODE_URL="${NODE_URL:-nats://172.17.0.1:4222}"
ETH_RPC_URL="${ETH_RPC_URL:-http://172.17.0.1:8545}"
POSTGRES_HOST="${POSTGRES_HOST:-172.17.0.1}"
postgres_db="${project}"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"

# Kill the service when this script exits
function cleanup {
  echo
  echo "Integration testing complete, removing service:"
  docker service remove $test_runner_host 2> /dev/null || true
  if [[ -n "$logs_pid" ]]
  then kill $logs_pid
  fi
  echo "Done!"
}
trap cleanup EXIT

# Damn I forget where I copy/pasted this witchcraft from, yikes.
# It's supposed to find out whether we're calling this script from a shell & can print stuff
# Or whether it's running in the background of another script and can't attach to a screen
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

docker network create --attachable $network 2> /dev/null || true

########################################
# Run Tests

echo
echo "Deploying integration tester..."

docker run \
  --entrypoint "bash" \
  --env="INDRA_CLIENT_LOG_LEVEL=$log_level" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  --env="INDRA_PG_DATABASE=$postgres_db" \
  --env="INDRA_PG_HOST=$POSTGRES_HOST" \
  --env="INDRA_PG_PASSWORD=$postgres_password" \
  --env="INDRA_PG_PORT=$postgres_port" \
  --env="INDRA_PG_USERNAME=$postgres_user" \
  --env="NODE_ENV=development" \
  $interactive \
  --name="$test_runner_host" \
  --network="$network" \
  --rm \
  --tty \
  --volume="$cwd:/root" \
  ${project}_bot -c '
    echo "Integration Tester Container launched!";echo
    echo

    cd modules/integration-test
    export PATH=./node_modules/.bin:$PATH
    ls ./node_modules/.bin

    function finish {
      echo && echo "Integration tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    '"$command"'
  '
