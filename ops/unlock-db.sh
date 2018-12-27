#!/usr/bin/env bash
set -e

service=connext_database
container=`for f in $(docker service ps -q $service)
do docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $f
done | head -n1`

docker exec $container rm /var/lib/postgresql/data/postmaster.pid
