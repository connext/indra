#!/usr/bin/env bash
set -e

name=$1 && [[ -n "$name" ]] || name=connext

docker container stop ${name}_builder 2> /dev/null || true
docker stack rm $name

echo -n "Waiting for the $name stack to shutdown."
while [[ -n "`docker container ls | tail -n +2 | grep $name`" ]]
do echo -n '.' && sleep 3
done
sleep 3
echo ' Goodnight!'
