#!/bin/bash
set -e
project=connext

POSTGRES_DB="test_$project"
POSTGRES_USER="$project"
POSTGRES_PASSWORD="$project"
POSTGRES_HOST="test_${project}_database"

# Kill the test database when this script exits
function cleanup {
  echo "Tests finished, stopping test database.."
  docker container stop $POSTGRES_HOST
}
trap cleanup EXIT

# Start test database
docker run \
  --rm \
  --detach \
  --name=$POSTGRES_HOST \
  --env POSTGRES_DB=$POSTGRES_DB \
  --env POSTGRES_USER=$POSTGRES_USER \
  --env POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  --tmpfs /var/lib/postgresql/data \
  --network=$project \
  ${project}_database:dev

# Run tests
docker run \
  --rm \
  --env POSTGRES_HOST=$POSTGRES_HOST \
  --env POSTGRES_DB=$POSTGRES_DB \
  --env POSTGRES_USER=$POSTGRES_USER \
  --env POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  --network=$project \
  --entrypoint=bash \
  ${project}_hub:dev ops/test.entry.sh
