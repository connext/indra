#!/usr/bin/env bash
set -e

chain_id="${1:-1337}"
tag="${2:-$chain_id}"

data_dir="${INDRA_TESTNET_DATA_DIR:-/data}"
port="${INDRA_TESTNET_PORT:-8545}"
mnemonic="${INDRA_TESTNET_MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"
image="${INDRA_TESTNET_IMAGE:-builder}"

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

ethprovider_host="${project}_testnet_$tag"

if [[ -n `docker container ls | grep ${ethprovider_host}` ]]
then
  echo "A container called $ethprovider_host already exists"
  exit
fi

if [[ "$image" == "builder" ]]
then
  docker run \
    --detach \
    --entrypoint "bash" \
    --env "DATA_DIR=$data_dir}" \
    --env "CHAIN_ID=$chain_id" \
    --env "MNEMONIC=$mnemonic" \
    --mount "type=bind,source=`pwd`,target=/root" \
    --mount "type=volume,source=${project}_chain_${chain_id},target=/data" \
    --name "$ethprovider_host" \
    --publish "$port:8545" \
    --rm \
    --tmpfs "/tmpfs" \
    ${project}_builder -c "cd modules/contracts && bash ops/start.sh"

elif [[ "$image" == "ethprovider" ]]
then
  docker run \
    --detach \
    --env "DATA_DIR=$data_dir" \
    --env "CHAIN_ID=$chain_id" \
    --env "MNEMONIC=$mnemonic" \
    --mount "type=volume,source=${project}_chain_${chain_id},target=/data" \
    --name "$ethprovider_host" \
    --publish "$port:8545" \
    --tmpfs "/tmpfs" \
    ${project}_ethprovider

else
  echo 'Expected INDRA_TESTNET_IMAGE to be either "builder" or "ethprovider"'
fi

while ! curl -s http://localhost:$port > /dev/null
do sleep 1
done
echo "Provider for chain ${chain_id} is awake & ready to go on port ${port}!"
