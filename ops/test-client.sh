#!/usr/bin/env bash
set -e

# get absolute path of this module
dir=`pwd | sed 's/indra.*/indra/'`/modules/client

echo "Activating tester.."
date "+%s" > /tmp/timestamp

function cleanup {
  echo "Testing complete in $((`date "+%s"` - `cat /tmp/timestamp`)) seconds!"
}
trap cleanup EXIT

docker run \
  --interactive \
  --tty \
  --rm \
  --name=connext_tester \
  --volume=$dir:/root \
  --entrypoint=bash \
  connext_builder:dev -c '
    PATH=./node_modules/.bin:$PATH
    echo "Running tests.."
    mocha \
      -r ts-node/register/type-check \
      -r ./src/register/common.ts \
      -r ./src/register/testing.ts \
      "src/**/*.test.ts" --exit
  '
