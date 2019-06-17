#!/usr/bin/env bash
set -e

########################################
# Setup Some Local Vars

users="$@"
dir="`cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd`/.."
project="`cat $dir/package.json | grep '"name":' | awk -F '"' '{print $4}'`"
name="${project}_disputer"
service=${project}_hub
service_id="`docker service ps -q $service | head -n 1`"
container_id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"

########################################
# Load our arguments and do some sanity checks

docker exec -i $container_id bash -c '
  export DATABASE_URL="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$POSTGRES_URL/$POSTGRES_DB"
  export WEBSOCKET_PORT=
  echo "Preparing to dispute channel for users: '"$users"'"
  node dist/spankchain/main.js exit-channels '"$users"'
'
