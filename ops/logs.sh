#!/bin/bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

name=$1
shift

service_id="`docker service ls --format '{{.ID}} {{.Name}}' |\
  cut -d "." -f 1 |\
  grep "$name" |\
  sort |\
  head -n 1 |\
  cut -d " " -f 1
`"

if [[ -n "$service_id" ]]
then

  docker service ps --no-trunc $service_id
  sleep 0.5
  docker service logs --tail 100 --follow $service_id

else
  echo "No running service names match: $name"

  container_id="`docker container ls --filter 'status=running' --format '{{.ID}} {{.Names}}' |\
    cut -d "." -f 1 |\
    grep "$name" |\
    sort |\
    head -n 1 |\
    cut -d " " -f 1
  `"

  if [[ -z "$container_id" ]]
  then echo "No running container names match: $name"
  else docker container logs --tail 100 --follow $container_id
  fi

fi
