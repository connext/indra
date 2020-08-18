#!/bin/bash

if [[ -d "modules/node" ]]
then cd modules/node
fi

cmd="${1:-test}"

if [[ "$NODE_ENV" == "production" ]]
then opts="--forbid-only"
else opts="--bail"
fi

if [[ "$cmd" == "watch" ]]
then
  echo "Starting node watcher"

  test_pid=""
  prev_checksum=""
  while true
  do
    checksum="`find src -type f -not -name "*.swp" -exec sha256sum {} \; | sha256sum`"
    if [[ "$checksum" != "$prev_checksum" ]]
    then
      echo
      echo "Changes detected!"

      if [[ -n "$test_pid" ]]
      then
        echo "Stopping previous test run"
        kill $test_pid 2> /dev/null
        sleep 2 # give prev tests a chance to shut down gracefully
      fi

      echo "Re-running tests..."
      ts-mocha --bail --check-leaks --exit --timeout 60000 'src/**/*.spec.ts' &
      test_pid=$!
      prev_checksum=$checksum

    # If no changes, do nothing
    else sleep 2
    fi
  done

else

  echo "Starting node tester"
  exec ts-mocha $opts --bail --check-leaks --exit --timeout 60000 'src/**/*.spec.ts'
fi
