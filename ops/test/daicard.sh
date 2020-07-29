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

make start-daicard

########################################
## Start the UI e2e watcher if in watch mode

if [[ "$1" == "--watch" ]]
then exec $cypress open
fi

########################################
## Start the UI e2e tests if in standalone test mode

export ELECTRON_ENABLE_LOGGING=true
$cypress run --spec cypress/tests/daicard.js
