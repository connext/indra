#!/usr/bin/env bash
set -e

version="${1:-latest}"
name="indra_test_runner"

# Kill the service when this script exits
function cleanup {
  echo "Stopping test runner.."
  docker container stop $name || true
  echo "Done!"
  echo "Node logs:"
  docker service logs --raw --tail 200 indra_node
}
trap cleanup EXIT


# Damn I forget where I copy/pasted this witchcraft from, yikes.
# It's supposed to find out whether we're calling this script from a shell & can print stuff
# Or whether it's running in the background of another script and can't attach to a screen
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

docker network create --attachable $name 2> /dev/null || true

docker run \
  --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  $interactive \
  --name="$name" \
  --network="$name" \
  --rm \
  --tty \
  $name:$version "$@"
