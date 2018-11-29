#!/bin/bash

project=connext
name=$1
shift
set -e
docker service ps --no-trunc ${project}_$name
sleep 1
docker service logs --tail 100 --follow ${project}_$name $@
