#!/bin/bash
set -e
project=connext

POSTGRES_DB="test_$project"
POSTGRES_USER="$project"
POSTGRES_PASSWORD="$project"
POSTGRES_HOST="${project}_test_database"
REDIS_HOST="${project}_test_redis"
ETHPROVIDER_HOST="${project}_test_ethprovider"

# Kill the test database when this script exits
function cleanup {
  echo "Tests finished, stopping test containers.."
  docker container stop $REDIS_HOST 2> /dev/null || true
  docker container stop $ETHPROVIDER_HOST 2> /dev/null || true
  docker container stop $POSTGRES_HOST 2> /dev/null || true
  docker container stop ${project}_tester 2> /dev/null || true
}
trap cleanup EXIT

# Start test redis
docker run --rm --detach --name=$REDIS_HOST --network=$project redis:5-alpine

# Start test ethprovider
docker run --rm --detach --name=$ETHPROVIDER_HOST --network=$project \
  --env ETH_NETWORK_ID=4447 \
  --env ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" \
  ${project}_ethprovider:dev

# Start test database
docker run --rm --detach --name=$POSTGRES_HOST --network=$project \
  --env POSTGRES_DB=$POSTGRES_DB \
  --env POSTGRES_USER=$POSTGRES_USER \
  --env POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  --tmpfs /var/lib/postgresql/data \
  ${project}_database:dev

# Run tests
docker run --rm --tty --name ${project}_tester --network=$project \
  --env ETHPROVIDER_HOST=$ETHPROVIDER_HOST \
  --env REDIS_HOST=$REDIS_HOST \
  --env POSTGRES_HOST=$POSTGRES_HOST \
  --env POSTGRES_DB=$POSTGRES_DB \
  --env POSTGRES_USER=$POSTGRES_USER \
  --env POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  --entrypoint=bash ${project}_hub:dev ops/test.entry.sh
