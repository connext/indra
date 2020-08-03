#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

username=$project
database=$project
service=${project}_redis
service_id="`docker service ps -q $service | head -n 1`"
container_id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"

if [[ -z "$1" ]]
then docker exec -it $container_id sh -c "redis-cli"
else docker exec -it $container_id sh -c "redis-cli \"$1\""
fi
