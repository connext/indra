#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

mode="${TEST_MODE:-local}"
name="${project}_test_runner"
commit="`git rev-parse HEAD | head -c 8`"
release="`cat package.json | grep '"version":' | awk -F '"' '{print $4}'`"

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

if [[ -z "`docker network ls -f name=$project | grep -w $project`" ]]
then
  id="`docker network create --attachable --driver overlay $project`"
  echo "Created ATTACHABLE network with id $id"
fi

if [[ -n "`docker image ls -q $name:$1`" ]]
then image=$name:$1; shift # rm $1 from $@
elif [[ "$mode" == "release" ]]
then image=$name:$release;
elif [[ "$mode" == "staging" ]]
then image=$name:$commit;
else

  exec docker run \
    $interactive \
    --entrypoint="bash" \
    --env="INDRA_ADMIN_TOKEN=$INDRA_ADMIN_TOKEN" \
    --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
    --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
    --env="INDRA_NATS_URL=$NATS_URL" \
    --env="INDRA_NODE_URL=$NODE_URL" \
    --env="NODE_ENV=development" \
    --env="NODE_TLS_REJECT_UNAUTHORIZED=0" \
    --mount="type=bind,source=`pwd`,target=/root" \
    --name="$name" \
    --network="$project" \
    --rm \
    ${project}_builder -c "cd modules/test-runner && bash ops/entry.sh $@"
fi

echo "Executing image $image"

exec docker run \
  $interactive \
  $watchOptions \
  --env="INDRA_ADMIN_TOKEN=${INDRA_ADMIN_TOKEN}" \
  --env="INDRA_CLIENT_LOG_LEVEL=0" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NATS_URL=$NATS_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  --env="NODE_ENV=production" \
  --env="NODE_TLS_REJECT_UNAUTHORIZED=0" \
  --name="$name" \
  --network="$project" \
  --rm \
  $image $@
