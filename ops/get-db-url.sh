#!/usr/bin/env bash
set -e

container=`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $(docker service ps -q connext_database)`
function get {
  docker exec $container env | grep $1 | awk -F '=' '{print $2}'
}
echo "postgresql://`get USER`:`docker exec $container cat $(get PASSWORD_FILE)`@localhost:5432/`get DB`"
