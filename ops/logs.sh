#!/bin/bash
set -e

project=connext
name=$1
shift

docker service ps --no-trunc ${project}_$name
sleep 1
docker service logs --tail 100 --follow ${project}_$name $@
