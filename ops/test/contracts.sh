#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

exec docker run \
  $interactive \
  --entrypoint="bash" \
  --name="${project}_test_contracts" \
  --rm \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    if [[ -d modules/contracts ]]
    then cd modules/contracts
    fi

    npm run test
  '
