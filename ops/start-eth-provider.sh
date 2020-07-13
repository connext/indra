#!/usr/bin/env bash
set -e

chainId="${1:-1337}"
data_dir="${INDRA_ETH_PROVIDER_DATA_DIR:-/data}"
port="${INDRA_ETH_PROVIDER_PORT:-8545}"

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

ethprovider_host="${project}_testnet_$chainId"

if [[ -n `docker container ls | grep ${ethprovider_host}` ]]
then
  echo "A container called $ethprovider_host already exists"
  exit
fi

docker run \
  --detach \
  --entrypoint "bash" \
  --env "DATA_DIR=$data_dir}" \
  --mount "type=bind,source=`pwd`,target=/root" \
  --mount "type=volume,source=${project}_chain_${chainId},target=/data" \
  --name "$ethprovider_host" \
  --publish "$port:8545" \
  --rm \
  --tmpfs "/tmp" \
  ${project}_builder -c "cd modules/contracts && bash ops/ganache.entry.sh start"
