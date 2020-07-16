#!/bin/bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

name=$1
shift

if [[ "$name" =~ [0-9]+ ]]
then
  docker container logs --tail 100 --follow "${project}_testnet_${name}" $@
else
  docker service ps --no-trunc "${project}_$name"
  sleep 1
  docker service logs --raw --tail 100 --follow "${project}_$name" $@
fi

