#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

docker stack rm $project 2> /dev/null || true

# Only stop the core indra stack unless an arg "all" is provided in which case stop everything
if [[ "$1" == "all" ]]
then docker container ls -f name=${project}_* -q | xargs docker container stop 2> /dev/null || true
fi

echo -n "Waiting for the $project stack to shutdown."

# wait until there are no more containers in this stack
while [[ -n "`docker container ls --quiet --filter label=com.docker.stack.namespace=$project`" ]]
do echo -n '.' && sleep 3
done

# wait until the stack's network has been removed
while [[ -n "`docker network ls --quiet --filter label=com.docker.stack.namespace=$project`" ]]
do echo -n '.' && sleep 3
done

echo ' Goodnight!'
