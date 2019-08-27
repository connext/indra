#!/bin/bash
set -e

project="indra"
name=$1
shift

ganache_logs=modules/contracts/ops/ganache.log

if [[ "$name" == "ganache" && -f "$ganache_logs" ]]
then
  docker service ps --no-trunc ${project}_ethprovider
  sleep 1
  tail -f $ganache_logs
else
  docker service ps --no-trunc ${project}_$name
  sleep 1
  docker service logs --raw --tail 100 --follow ${project}_$name $@
fi

