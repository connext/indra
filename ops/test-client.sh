#!/usr/bin/env bash
set -e

# get absolute path of this module
dir=`pwd | sed 's/indra.*/indra/'`/modules/client
project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"

bash ops/start-ganache.sh

echo "Activating client tester.."
date "+%s" > /tmp/timestamp

function cleanup {
  echo "Testing client complete in $((`date "+%s"` - `cat /tmp/timestamp`)) seconds!"
}
trap cleanup EXIT

docker container prune -f

docker run \
  --entrypoint=bash \
  --interactive \
  --name=${project}_tester \
  --network="ganache" \
  --rm \
  --tty \
  --volume=$dir:/root \
  ${project}_builder -c '
    set -e
    echo "Container launched.."
    PATH=./node_modules/.bin:$PATH
    mocha '"$watch"' \
      -r ts-node/register/type-check \
      -r ./src/register/common.ts \
      "src/**/*.test.ts" --exit
  '
