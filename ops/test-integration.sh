#!/usr/bin/env bash
set -e

name="indra_test_runner"
commit="`git rev-parse HEAD | head -c 8`"

if [[ -n "$1" && -n "`docker image ls -q $name:$1`" ]]
then image=$name:$1; shift # rm $1 from $@
elif [[ -z "$1" && -n "`docker image ls -q $name:$commit`" ]]
then image=$name:$commit
elif [[ -z "$1" ]]
then image=$name:latest
else echo "Aborting: couldn't find an image to run for input: $1" && exit 1
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
