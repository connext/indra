#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | jq .name | tr -d '"'`"

####################
# Internal Config
# config & hard-coded stuff you might want to change

test_runner_host="${project}_test_runner"

# Kill the service when this script exits
function cleanup {
  echo "Stopping test runner.."
  docker service remove $test_runner_host 2> /dev/null || true
  echo "Done!"
}
trap cleanup EXIT

# Damn I forget where I copy/pasted this witchcraft from, yikes.
# It's supposed to find out whether we're calling this script from a shell & can print stuff
# Or whether it's running in the background of another script and can't attach to a screen
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

network="${project}_$suffix"
docker network create --attachable $network 2> /dev/null || true

########################################
# Run Tests

echo
echo "Deploying integration tester..."

docker run \
  --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  $interactive \
  --name="$test_runner_host" \
  --network="$network" \
  --rm \
  --tty \
  ${project}_test_runner "$@"
