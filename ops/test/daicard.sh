#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
cypress="$root/node_modules/.bin/cypress"

# Make sure bare minimum dependencies are installed
if [[ ! -f "$cypress" || ! -d "./node_modules/ethers" ]]
then npm i --no-save
fi
$cypress install

########################################
## Start the UI e2e watcher if in watch mode

# If we're listening on 3001 then use that else it's probably prod mode
if [[ -n "`docker container ls --format '{{.Ports}}' | grep "0.0.0.0:3001"`" ]]
then env="--env publicUrl=http://localhost:3001"
else env="--env publicUrl=https://localhost:433"
fi

if [[ "$1" == "--watch" ]]
then
  $cypress open $env
  exit 0
fi

########################################
## Start the UI e2e tests if in standalone test mode

export ELECTRON_ENABLE_LOGGING=true
$cypress run $env --spec cypress/tests/daicard.js
