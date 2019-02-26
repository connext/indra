#!/bin/bash
set -e

timestamp="`date +"%y%m%d-%H%M%S"`"
backup_file=ops/snapshots/$timestamp.sql
mkdir -p ops/snapshots

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}' | tr -d '-'`"
service=${project}_database
service_id="`docker service ps -q $service | head -n 1`"
id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"

if [[ -z "`docker service ps -q $service`" ]]
then echo "Error: expected to see $service running" && exit 1
fi

echo "Creating database snapshot..."

docker exec $id bash -c "pg_dump --username=$project $project" > $backup_file

echo "Done"
