#!/usr/bin/env bash

service=connext_database
database=connext
username=connext

container=`for f in $(docker service ps -q $service)
do docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $f
done | head -n1`

if [[ -z "$1" ]]
then
    docker exec -it $container bash -c "psql $database --username=$username"
else
    docker exec -it $container bash -c "psql $database --username=$username --command=\"$1\""
fi
