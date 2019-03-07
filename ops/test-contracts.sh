#!/usr/bin/env bash
set -e

# get absolute path of indra/modules/contracts
dir=`pwd | sed 's/indra.*/indra/'`/modules/contracts
project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"

echo "Activating contracts tester.."
date "+%s" > /tmp/timestamp

function cleanup {
  echo "Testing contracts complete in $((`date "+%s"` - `cat /tmp/timestamp`)) seconds!"
}
trap cleanup EXIT

docker run \
  --interactive \
  --tty \
  --rm \
  --name=${project}_tester \
  --volume=$dir:/root \
  --volume=$dir/../client:/client \
  --tmpfs=/chaindata \
  --entrypoint=bash \
  ${project}_builder -c '
    set -e
    PATH=./node_modules/.bin:$PATH
    echo "Starting Ganache.."
    ganache-cli --networkId=4447 --db="/chaindata" > ops/ganache-test.log &
    echo "Running tests.."
    truffle test test/channelManager.js --network=ganache
  '
