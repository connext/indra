#!/usr/bin/env bash
set -e

# get absolute path of this module
dir=`pwd | sed 's/indra.*/indra/'`/modules/client
project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"

echo "Activating client tester.."
date "+%s" > /tmp/timestamp

function cleanup {
  echo "Testing client complete in $((`date "+%s"` - `cat /tmp/timestamp`)) seconds!"
}
trap cleanup EXIT

docker container prune -f

docker run \
  --interactive \
  --tty \
  --rm \
  --name=${project}_tester \
  --volume=$dir:/root \
  --entrypoint=bash \
  ${project}_builder -c '
    set -e
    echo "Container launched.."
    PATH=./node_modules/.bin:$PATH
    mocha '"$watch"' \
      -r ts-node/register/type-check \
      -r ./src/register/common.ts \
      -r ./src/register/testing.ts \
      "src/**/*.test.ts" --exit
  '
