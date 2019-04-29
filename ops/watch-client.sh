#!/usr/bin/env bash
set -e

# get absolute path of this module
dir=`pwd | sed 's/indra.*/indra/'`/modules/client
project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"

echo "Activating client watcher.."

docker run \
  --interactive \
  --tty \
  --rm \
  --name=${project}_watcher \
  --volume=$dir:/root \
  --entrypoint=bash \
  ${project}_builder -c '
    echo "Container launched.."
    PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "Goodbye" && exit
    }
    trap finish SIGTERM SIGINT

    function hash {
      find src -type f -not -name "*.sw?" -exec stat {} \; \
       | grep "Modify:" \
       | sha256sum
    }

    echo "Triggering first compilation/test cycle..."
    while true
    do
      if [[ "$srcHash" == "`hash`" ]]
      then sleep 1 && continue
      else srcHash="`hash`" && echo "Changes detected, compiling..."
      fi

      tsc

      if [[ "$?" != "0" ]]
      then sleep 1 && continue
      else echo "Compiled successfully, running test suite"
      fi

      mocha \
        -r ./dist/register/common.js \
        -r ./dist/register/testing.js \
        "dist/**/*.test.js" --exit

      echo "Waiting for changes..."

    done
    echo "Completely finished"
  '

