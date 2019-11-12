#!/usr/bin/env bash
set -e

project="indra"
cypress="node_modules/.bin/cypress"

# Make sure cypress is installed while we wait for the recipient bot to do it's thing
$cypress install > /dev/null

########################################
## Start the UI e2e watcher if in watch mode

# If there's no daicard service (webpack dev server) then we're running in prod mode
if [[ -z "`docker service ls | grep ${project}_daicard`" ]]
then env="--env publicUrl=https://localhost"
fi

if [[ "$1" == "--watch" ]]
then
  nice $cypress open $env
  exit 0
fi

########################################
## Start the UI e2e tests if in standalone test mode

export ELECTRON_ENABLE_LOGGING=true
nice $cypress run $env --spec cypress/tests/index.js
