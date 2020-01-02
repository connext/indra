#!/usr/bin/env bash
set -e

test_command='
  jest --config jest.config.js --forceExit '"$@"'
'

watch_command='
  exec jest --config jest.config.js --watch '"$@"'
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

########################################
# Run Tests

echo
echo "Deploying integration tester..."

id="`
docker service create \
  --detach \
  --name="$test_runner_host" \
  --env="INDRA_CLIENT_LOG_LEVEL=$log_level" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  --env="INDRA_PG_DATABASE=$postgres_db" \
  --env="INDRA_PG_HOST=$POSTGRES_HOST" \
  --env="INDRA_PG_PASSWORD=$postgres_password" \
  --env="INDRA_PG_PORT=$postgres_port" \
  --env="INDRA_PG_USERNAME=$postgres_user" \
  --env="NODE_ENV=development" \
  --mount="type=bind,source=$cwd,target=/root" \
  --restart-condition="none" \
  --entrypoint "bash" \
  ${project}_builder -c '
    echo "Integration Tester Container launched!";echo
    echo

    cd modules/integration-test
    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "Integration tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    '"$command"'
  '
`"
echo "Success! Deployer service started with id: $id"
echo

docker service logs --raw --follow $test_runner_host &
logs_pid=$!

# Wait for the deployer to exit..
while [[ -z "`docker container ls -a | grep "$test_runner_host" | grep "Exited"`" ]]
do sleep 1
done
