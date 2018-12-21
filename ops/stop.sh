#!/usr/bin/env bash
set -e

name=$1 && [[ -n "$name" ]] || name=connext

docker container stop ${name}_builder 2> /dev/null || true
docker stack rm $name 2> /dev/null || true

echo -n "Waiting for the $name stack to shutdown."

# wait until there are no more connext containers
while [[ -n "`docker container ls --quiet --filter label=com.docker.stack.namespace=$name`" ]]
do echo -n '.' && sleep 3
done

# wait until the connext stack network has been removed
while [[ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=$name`" ]]
do echo -n '.' && sleep 3
done

echo ' Goodnight!'
