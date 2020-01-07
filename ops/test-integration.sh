#!/usr/bin/env bash
set -e

version="${1:-latest}"

# Damn I forget where I copy/pasted this witchcraft from, yikes.
# It's supposed to find out whether we're calling this script from a shell & can print stuff
# Or whether it's running in the background of another script and can't attach to a screen
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

network="indra_test_runner"
docker network create --attachable $network 2> /dev/null || true

exec docker run \
  --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  $interactive \
  --name="indra_test_runner" \
  --network="$network" \
  --rm \
  --tty \
  indra_test_runner:$version "$@"
