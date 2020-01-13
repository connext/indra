#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | jq .name | tr -d '"'`"

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
test -t 0 -a -t 1 -a -t 2 && interactive="--interactive"

exec docker run \
  --entrypoint="bash" \
  --env="ECCRYPTO_NO_FALLBACK=true" \
  $interactive \
  --name="${project}_test_contracts" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "Contracts tester container launched!"

    cd modules/contracts
    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "CF tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    echo "Launching tests!";echo
    npm run test
  '
