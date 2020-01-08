#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | jq .name | tr -d '"'`"
name="${project}_test_runner"
commit="`git rev-parse HEAD | head -c 8`"

if [[ -z "$1" || ! "$1" =~ [0-9.] ]]
then
  if [[ -n "`docker image ls -q $name:$commit`" ]]
  then image=$name:$commit
  else image=$name:latest
  fi
elif [[ -n "`docker image ls -q $name:$1`" ]]
then image=$name:$1; shift # rm $1 from $@
else echo "Aborting: couldn't find an image to run for input: $1" && exit 1
fi

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

if [[ $@ == *"--watch"* ]]
then watchOptions="\
  --mount=type=bind,source=$dir/../,target=/root \
  --workdir=/root/modules/test-runner \
  --env=MODE=watch \
  "
fi

echo "Executing image $image"

exec docker run \
  $watchOptions \
  --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  $interactive \
  --name="$name" \
  --rm \
  --tty \
  $image $@
