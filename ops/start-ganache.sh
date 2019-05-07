#!/bin/bash

project=indra
name=ganache
ganache_net_id=4447
ganache_rpc_port=8545
dir=`pwd | sed 's/indra.*/indra/'`/modules/contracts
mnemonic='candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
ETH_MNEMONIC="${ETH_MNEMONIC:-$mnemonic}"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

if [[ -n "`docker container ls | grep $name`" ]]
then
  echo "Ganache is already running"
  echo "Stop it with: docker container stop $name"
  exit
fi

if [[ -z "`docker network ls -f name=$name | grep -w $name`" ]]
then
    id=`docker network create --attachable --driver overlay $name`
    echo "Created ATTACHABLE $name network with id $id"
fi

echo "Starting Ganache.."

docker run \
  --detach \
  --entrypoint=bash \
  --env="ETH_MNEMONIC=$ETH_MNEMONIC" \
  --name="$name" \
  --network="$name" \
  --publish="$ganache_rpc_port:$ganache_rpc_port" \
  --rm \
  --volume="$dir:/root" \
  --volume="${project}_chain_dev:/data" \
  ${project}_builder -c "
    echo Ganache container activated
    exec ./node_modules/.bin/ganache-cli \
      --host=0.0.0.0 \
      --port=$ganache_rpc_port \
      --db=/data \
      --mnemonic=\"$ETH_MNEMONIC\" \
      --networkId=$ganache_net_id \
      --blockTime=3
  "

sleep 1
echo "Ganache launched successfully"
