#!/usr/bin/env bash
set -e

# get absolute path of indra/modules/contracts
dir=`pwd | sed 's/indra.*/indra/'`/modules/contracts

echo "Activating tester.."
date "+%s" > /tmp/timestamp

docker run \
  --interactive \
  --tty \
  --rm \
  --name=connext_tester \
  --volume=$dir:/root \
  --volume=$dir/../client:/client \
  --tmpfs=/chaindata \
  --entrypoint=bash \
  connext_builder:dev -c '
    PATH=./node_modules/.bin:$PATH
    echo "Starting Ganache.."
    ganache-cli --networkId=4447 --db="/chaindata" > ops/ganache-test.log &
    echo "Running tests.."
    truffle test test/channelManager.js --network=ganache
  '

echo "Testing complete in $((`date "+%s"` - `cat /tmp/timestamp`)) seconds!"
