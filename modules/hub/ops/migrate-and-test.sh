#!/bin/sh

set -e
project=connext

# Start database container

docker run --rm --detach \
  --name connext-hub-test \
  --network hub \
  --publish 5432:5432 \
  --env POSTGRES_DB=connext-hub-test \
  --env POSTGRES_USER=user \
  --env POSTGRES_PASSWORD=pass \
  ${project}_database:dev

make -C ../src/sql/

psql sc-hub-test < src/sql/build/channel-manager.sql
# run docker test image with env vars

DATABASE_URL='postgresql://localhost:5432/sc-hub-test'
yarn test "${@}"
