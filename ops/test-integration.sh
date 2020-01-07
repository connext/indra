#!/usr/bin/env bash
set -e

name="indra_test_runner"
commit="`git rev-parse HEAD | head -c 8`"

if [[ -n "`docker image ls -q $name:$1`" ]]
then image=$name:$1
elif [[ -n "`docker image ls -q $name:$commit`" ]]
then image=$name:$commit
else image=$name:latest
fi

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

echo "Executing image $image"
exec docker run \
  --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  $interactive \
  --name="$name" \
  --rm \
  --tty \
  $image "$@"
