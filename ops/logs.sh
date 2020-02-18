#!/bin/bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

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

