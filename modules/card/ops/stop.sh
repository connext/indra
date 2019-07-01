#!/usr/bin/env bash
set -e

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}' | tr -d '-'`"
docker container stop ${project}_builder 2> /dev/null || true
docker container stop connext_card 2> /dev/null || true
docker stack rm $project 2> /dev/null || true

echo -n "Waiting for the $project stack to shutdown."

# wait until there are no more connext containers
while [[ -n "`docker container ls --quiet --filter label=com.docker.stack.namespace=$project`" ]]
do echo -n '.' && sleep 3
done

# wait until the connext stack network has been removed
while [[ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=$project`" ]]
do echo -n '.' && sleep 3
done

echo ' Goodnight!'
