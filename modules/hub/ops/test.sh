#!/bin/bash
set -e
project=connext

function cleanup {
  echo "Tests finished, tearing down test database.."
  docker container stop ${project}_test_database
}
trap cleanup EXIT

docker run \
  --rm \
  --name=${project}_test_database \
  --env POSTGRES_DB=test_$project \
  --env POSTGRES_USER=$project \
  --env POSTGRES_PASSWORD=$project \
  --tmpfs /var/lib/postgresql/data \
  --network=$project \
  ${project}_database:dev &

docker run --rm --network=$project ${project}_hub:test
