#!/usr/bin/env bash
set -e

## This script will start a testnet chain & store that chain's data in indra/.chaindata/${chainId}

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

chain_id="${1:-1337}"

port="${INDRA_CHAIN_PORT:-`expr 8545 - 1337 + $chain_id`}"
tag="${INDRA_TAG:-$chain_id}"
mnemonic="${INDRA_MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"
image="${INDRA_IMAGE:-builder}"
engine="${INDRA_EVM:-`if [[ "$chain_id" == "1337" ]]; then echo "ganache"; else echo "buidler"; fi`}"
logLevel="${INDRA_LOG_LEVEL:-0}"

ethprovider_host="${project}_testnet_$tag"

if [[ -n `docker container ls | grep ${ethprovider_host}` ]]
then
  echo "A container called $ethprovider_host already exists"
  exit
fi

chain_data="$root/.chaindata/$chain_id"
mkdir -p $chain_data

if [[ "$image" == "builder" ]]
then
  docker run \
    --detach \
    --entrypoint "bash" \
    --env "CHAIN_ID=$chain_id" \
    --env "ENGINE=$engine" \
    --env "MNEMONIC=$mnemonic" \
    --mount "type=bind,source=$chain_data,target=/data" \
    --mount "type=bind,source=$root,target=/root" \
    --name "$ethprovider_host" \
    --publish "$port:8545" \
    --rm \
    --tmpfs "/tmpfs" \
    ${project}_builder -c "cd modules/contracts && bash ops/entry.sh"

elif [[ "$image" == "ethprovider" ]]
then
  docker run \
    --detach \
    --env "CHAIN_ID=$chain_id" \
    --env "ENGINE=$engine" \
    --env "MNEMONIC=$mnemonic" \
    --mount "type=bind,source=$chain_data,target=/data" \
    --name "$ethprovider_host" \
    --publish "$port:8545" \
    --tmpfs "/tmpfs" \
    ${project}_ethprovider

else
  echo 'Expected INDRA_IMAGE to be either "builder" or "ethprovider"'
  exit 1
fi

if [[ "$logLevel" -gt "0" ]]
then
  docker container logs --follow $ethprovider_host &
  pid=$!
fi

while ! curl -s http://localhost:$port > /dev/null
do
  if [[ -z `docker container ls -f name=$ethprovider_host -q` ]]
  then echo "$ethprovider_host was not able to start up successfully" && exit 1
  else sleep 1
  fi
done
echo "Provider for chain ${chain_id} is awake & ready to go on port ${port}!"
