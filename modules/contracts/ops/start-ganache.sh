#!/bin/bash

project=indra
name=ganache
ganache_net_id=4447
ganache_rpc_port=8545
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
  --detach \
  --name="$name" \
  --env="ETH_MNEMONIC=$ETH_MNEMONIC" \
  --volume="${project}_chain_dev:/data" \
  --volume="$dir:/root" \
  --publish="$ganache_rpc_port:$ganache_rpc_port" \
  --entrypoint=bash \
  ${project}_builder -c "
    echo lets go ganache diggy
    exec ./node_modules/.bin/ganache-cli \
      --host=0.0.0.0 \
      --port=$ganache_rpc_port \
      --db=/data \
      --mnemonic=\"$ETH_MNEMONIC\" \
      --networkId=$ganache_net_id \
      --blockTime=3 > ops/ganache.log
  "

sleep 1
echo "Ganache launched successfully"
