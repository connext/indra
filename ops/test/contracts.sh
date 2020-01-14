#!/usr/bin/env bash
set -e

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive"
fi

exec docker run \
  $interactive \
  --entrypoint="bash" \
  --name="indra_test_contracts" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  indra_builder -c '
    if [[ -d modules/contracts ]]
    then cd modules/contracts
    fi

    npm run test
  '
