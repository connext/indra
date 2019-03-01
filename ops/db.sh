#!/usr/bin/env bash
set -e

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"
username=$project
database=$project

service=${project}_database
service_id="`docker service ps -q $service | head -n 1`"
container_id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"

if [[ -z "$1" ]]
then docker exec -it $container_id bash -c "psql $database --username=$username"
else docker exec -it $container_id bash -c "psql $database --username=$username --command=\"$1\""
fi
