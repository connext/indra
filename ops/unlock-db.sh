#!/usr/bin/env bash
set -e

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"
service=${project}_database

service_id="`docker service ps -q $service | head -n 1`"
container_id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"

docker exec $container_id rm /var/lib/postgresql/data/postmaster.pid

if [[ "$?" == "0" ]]
then echo "success"
else echo "something went wrong"
fi
