#!/usr/bin/env bash
set -e

here="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $here/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

chain_id="${1:-1337}"
port="${2:-8545}"

data_dir="${INDRA_DATA_DIR:-/tmpfs}"
tag="${INDRA_TAG:-$chain_id}"
mnemonic="${INDRA_MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"
image="${INDRA_IMAGE:-builder}"
engine="${INDRA_EVM:-ganache}"
logLevel="${INDRA_LOG_LEVEL:-0}"

ethprovider_host="${project}_testnet_$tag"

if [[ -n `docker container ls | grep ${ethprovider_host}` ]]
then
  echo "A container called $ethprovider_host already exists"
  exit
fi

if [[ "$data_dir" == "/data" ]]
then persist="--mount type=volume,source=${project}_chain_${chain_id},target=/data"
else persist=""
fi

if [[ "$image" == "builder" ]]
then
  docker run \
    $persist \
    --detach \
    --entrypoint "bash" \
    --env "CHAIN_ID=$chain_id" \
    --env "DATA_DIR=$data_dir" \
    --env "ENGINE=$engine" \
    --env "MNEMONIC=$mnemonic" \
    --mount "type=bind,source=`pwd`,target=/root" \
    --name "$ethprovider_host" \
    --publish "$port:8545" \
    --rm \
    --tmpfs "/tmpfs" \
    ${project}_builder -c "cd modules/contracts && bash ops/entry.sh"

elif [[ "$image" == "ethprovider" ]]
then
  docker run \
    $persist \
    --detach \
    --env "CHAIN_ID=$chain_id" \
    --env "DATA_DIR=$data_dir" \
    --env "ENGINE=$engine" \
    --env "MNEMONIC=$mnemonic" \
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
