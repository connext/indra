#!/bin/bash

DIR="$( cd "$(dirname "$0")" ; pwd -P )"

# Start fresh postgresql databases
docker network create hub 2> /dev/null || true

docker run --rm --detach \
  --name postgres \
  --network hub \
  --publish 5432:5432 \
  --env POSTGRES_DB=sc-hub \
  --env POSTGRES_USER=user \
  --env POSTGRES_PASSWORD=pass \
  postgres:9.6-alpine

docker run --rm --detach \
  --name postgres-test \
  --network hub \
  --publish 5431:5432 \
  --env POSTGRES_DB=sc-hub-test \
  --env POSTGRES_USER=user \
  --env POSTGRES_PASSWORD=pass \
  postgres:9.6-alpine

docker run --rm --detach \
  --name redis \
  --network hub \
  --publish 6379:6379 \
  redis:5-alpine

$DIR/wait-for-it.sh localhost:5432
$DIR/wait-for-it.sh localhost:5431

echo 'Databases are awake'

# Run migrate
docker run --rm --tty \
  --name db-migrate \
  --network hub \
  --volume=`pwd`/:/hub \
  --env WALLET_ADDRESS=0xfb482f8f779fd96a857f1486471524808b97452d \
  --env CHANNEL_MANAGER_ADDRESS=0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42 \
  --env ETH_RPC_URL=http://localhost:8545 \
  --env HOT_WALLET_ADDRESS=0xfb482f8f779fd96a857f1486471524808b97452d \
  --env SERVICE_USER_KEY=foo \
  --env TOKEN_CONTRACT_ADDRESS=0xd01c08c7180eae392265d8c7df311cf5a93f1b73 \
  --env DATABASE_URL=postgres://user:pass@postgres:5432/sc-hub \
  builder:dev "yarn migrate"

# Run migrate-test
docker run --rm --tty \
  --name db-migrate-test \
  --network hub \
  --volume=`pwd`/:/hub \
  --env WALLET_ADDRESS=0xfb482f8f779fd96a857f1486471524808b97452d \
  --env CHANNEL_MANAGER_ADDRESS=0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42 \
  --env ETH_RPC_URL=http://localhost:8545 \
  --env HOT_WALLET_ADDRESS=0xfb482f8f779fd96a857f1486471524808b97452d \
  --env SERVICE_USER_KEY=foo \
  --env TOKEN_CONTRACT_ADDRESS=0xd01c08c7180eae392265d8c7df311cf5a93f1b73 \
  --env DATABASE_URL=postgres://user:pass@postgres-test:5432/sc-hub-test \
  builder:dev "yarn migrate-test"

# Clean up after ourselves
docker container stop db-migrate 2> /dev/null || true
docker container stop db-migrate-test 2> /dev/null || true

echo 'Database migrations are finished'
