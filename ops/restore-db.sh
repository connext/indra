#!/bin/bash
set -e

if [[ -n "$1" && -f "$1" ]]
then file="$1"
else file="ops/snapshots/`ls ops/snapshots | sort -r | head -n 1`"
fi

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}' | tr -d '-'`"
service=${project}_database
service_id="`docker service ps -q $service | head -n 1`"
id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"

if [[ -z "`docker service ps -q $service`" ]]
then echo "Error: expected to see $service running" && exit 1
fi

echo "Loading SQL from $file..."

exit ## needs further testing, beware
cat $file | docker exec --interactive $id bash -c "psql --username=$project $project" -

echo "Done"
