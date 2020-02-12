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
  --entrypoint="bash" \
  --env="ECCRYPTO_NO_FALLBACK=true" \
  $interactive \
  --name="${project}_test_client" \
  --rm \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "Client tester container launched!"
    
    if [[ ! -d modules/client/node_modules/secp256k1 ]]
    then cp -r node_modules/secp256k1 modules/client/node_modules/secp256k1
    fi
    cd modules/client

    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "CF tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    echo "Launching tests!";echo
    npm run test
  '
