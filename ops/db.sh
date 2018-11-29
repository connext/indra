#!/usr/bin/env bash

service=connext_postgres

container=`for f in $(docker service ps -q $service)
do
  docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $f
done | head -n1`

if [[ -z "$1" ]]
then
    docker exec -it $container bash -c 'psql connext --username=connext'
else
    docker exec -it $container bash -c "psql connext --username=connext --command=\"$1\""
fi
