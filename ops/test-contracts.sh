#!/bin/bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | jq .name | tr -d '"'`"

test_command='
  ts-mocha test/*
'

watch_command='
  exec ts-mocha --watch test/*
'

if [[ "$1" == "--watch" ]]
then
  suffix="node_watcher"
  command="$watch_command"
  shift # forget $1 and replace it w $2, etc
else
  suffix="node_tester"
  command="$test_command"
fi

########################################
# Run Tests

echo "Starting $node_host.."
docker run \
  --entrypoint="bash" \
  --interactive \
  --name="$node_host" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    echo "Contract Tester Container launched!";echo

    cd modules/contracts
    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "Node tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    '"$command"'

  '
