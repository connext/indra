#!/usr/bin/env bash

name=connext
docker stack rm $name
echo -n "Waiting for the $name stack to shutdown."
while [[ -n "`docker container ls | tail -n +2 | grep $name`" ]]
do
    echo -n '.'
    sleep 2
done
echo ' Goodnight!'