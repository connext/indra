#!/bin/bash

name=ganache
ganache_net_id=4447
ganache_rpc_port=8546
dir=`pwd | sed 's/indra.*/indra/'`/modules/contracts

if [[ -n "`docker container ls | grep $name`" ]]
then
  echo "Ganache is already running"
  echo "Stop it with: docker container stop $name"
  exit
fi

echo "Starting Ganache.."

docker run \
  --rm \
  --name="$name" \
  --env="ETH_MNEMONIC=$ETH_MNEMONIC" \
  --volume="connext_chain_dev:/data" \
  --volume="$dir:/root" \
  --publish="$ganache_rpc_port:$ganache_rpc_port" \
  --entrypoint=bash \
  connext_ethprovider -c "
    echo lets go ganache diggy
    ./node_modules/.bin/ganache-cli \
      --host=0.0.0.0 \
      --port=$ganache_rpc_port \
      --db=/data \
      --mnemonic=\"$ETH_MNEMONIC\" \
      --networkId=$ganache_net_id \
      --blockTime=3 > ops/ganache.log
  " &

echo "Launched.."

sleep 1
docker container logs --follow $name
