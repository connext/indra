#!/bin/bash

if [[ -d "modules/test-runner" ]]
then cd modules/test-runner
fi

cmd="${1:-test}"

# Set defaults in src/util/env instead of here
export INDRA_ADMIN_TOKEN="$INDRA_ADMIN_TOKEN"
export INDRA_CHAIN_PROVIDERS="$INDRA_CHAIN_PROVIDERS"
export INDRA_CLIENT_LOG_LEVEL="$INDRA_CLIENT_LOG_LEVEL"
export INDRA_LOG_LEVEL="$INDRA_LOG_LEVEL"
export INDRA_CONTRACT_ADDRESSES="$INDRA_CONTRACT_ADDRESSES"
export INDRA_NATS_URL="$INDRA_NATS_URL"
export INDRA_NODE_URL="$INDRA_NODE_URL"

export NODE_ENV="${NODE_ENV:-development}"

########################################
# Wait for indra stack dependencies

function wait_for {
  name=$1
  target=$2
  tmp=${target#*://} # remove protocol
  host=${tmp%%/*} # remove path if present
  if [[ ! "$host" =~ .*:[0-9]{1,5} ]] # no port provided
  then
    echo "$host has no port, trying to add one.."
    if [[ "${target%://*}" == "http" ]]
    then host="$host:80"
    elif [[ "${target%://*}" == "https" ]]
    then host="$host:443"
    else echo "Error: missing port for host $host derived from target $target" && exit 1
    fi
  fi
  echo "Waiting for $name at $target ($host) to wake up..."
  wait-for -t 60 $host 2> /dev/null
}

wait_for "node" "$INDRA_NODE_URL"
wait_for "nats" "$INDRA_NATS_URL"

########################################
# Launch tests

bundle=dist/tests.bundle.js

if [[ ! -f "$bundle" ]]
then webpack --config ops/webpack.config.js
fi

if [[ "$NODE_ENV" == "production" ]]
then opts="--forbid-only"
else opts="--bail"
fi

build_tests="webpack --config ops/webpack.config.js"
run_tests="mocha --slow 1000 --timeout 180000 --check-leaks --exit $opts $bundle"
test_pid=""

if [[ "$cmd" == "watch" ]]
then
  echo "Starting test-watcher"

  # use ts-mocha here instead?
  # mocha --slow 1000 --timeout 180000 --check-leaks --exit $opts $bundle

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
      fi
      echo "Rebuilding tests.."
      eval "$build_tests"
      echo
      if [[ "$?" != 0 ]]
      then
        echo "Tests did not build successfully! Waiting for changes.."
        prev_checksum=$checksum
      else
        echo "Tests built successfully! Running tests..."
        eval "$run_tests &"
        test_pid=$!
        prev_checksum=$checksum
      fi
    # If no changes, do nothing
    else sleep 2
    fi
  done

else
  echo "Starting test-runner"
  eval "$run_tests"
fi
