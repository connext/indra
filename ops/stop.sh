#!/usr/bin/env bash

name=$1; [[ -n "$name" ]] || name=connext

docker container stop builder 2> /dev/null || true
docker stack rm $name
echo -n "Waiting for the $name stack to shutdown."
while [[ -n "`docker container ls | tail -n +2 | grep $name`" ]]
do
    echo -n '.'
    sleep 2
done
echo ' Goodnight!'
