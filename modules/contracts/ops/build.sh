#!/bin/bash

function getHash {
  find build/contracts contracts migrations -type f -not -name "*.swp" |\
  xargs cat |\
  sha256sum |\
  tr -d ' -'
}

state=build/state-hash
if [[ -f "$state" && "`getHash`" == "`cat $state`"  ]]
then echo "Contracts are up to date"
else ./node_modules/.bin/truffle compile
fi


