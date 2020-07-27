#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

mode="${INDRA_ENV:-local}"
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

source $root/dev.env

########################################
## Retrieve testnet env vars

chain_id_1=1337; chain_id_2=1338

providers_file="$root/.chaindata/providers/${chain_id_1}-${chain_id_2}.json"
addresses_file="$root/.chaindata/addresses/${chain_id_1}-${chain_id_2}.json"
if [[ ! -f "$providers_file" ]]
then echo "File ${providers_file} does not exist, make sure the testnet chains are running" && exit 1
elif [[ ! -f "$addresses_file" ]]
then echo "File ${addresses_file} does not exist, make sure the testnet chains are running" && exit 1
fi
chain_providers="`cat $providers_file`"
contract_addresses="`cat $addresses_file`"

########################################
## Launch test image

if [[ -n "`docker image ls -q $name:$1`" ]]
then image=$name:$1; shift # rm $1 from $@
elif [[ "$mode" == "release" ]]
then image=$name:$release;
elif [[ "$mode" == "staging" ]]
then image=$name:$commit;
else

  echo "Executing image ${project}_builder"

  exec docker run \
    $interactive \
    --entrypoint="bash" \
    --env="INDRA_ADMIN_TOKEN=$INDRA_ADMIN_TOKEN" \
    --env="INDRA_CHAIN_PROVIDERS=$chain_providers" \
    --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
    --env="INDRA_CONTRACT_ADDRESSES=$contract_addresses" \
    --env="INDRA_NATS_URL=nats://indra:4222" \
    --env="INDRA_NODE_URL=http://indra" \
    --env="NODE_ENV=development" \
    --env="NODE_TLS_REJECT_UNAUTHORIZED=0" \
    --mount="type=bind,source=$root,target=/root" \
    --name="$name" \
    --network="$project" \
    --rm \
    --tmpfs "/tmpfs" \
    ${project}_builder -c "cd modules/test-runner && bash ops/entry.sh $@"
fi

echo "Executing image $image"

exec docker run \
  $interactive \
  $watchOptions \
  --env="INDRA_ADMIN_TOKEN=$INDRA_ADMIN_TOKEN" \
  --env="INDRA_CHAIN_PROVIDERS=$chain_providers" \
  --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_CONTRACT_ADDRESSES=$contract_addresses" \
  --env="INDRA_NATS_URL=nats://indra:4222" \
  --env="INDRA_NODE_URL=https://indra" \
  --env="NODE_ENV=production" \
  --env="NODE_TLS_REJECT_UNAUTHORIZED=0" \
  --name="$name" \
  --network="$project" \
  --rm \
  --tmpfs "/tmpfs" \
  $image $@
