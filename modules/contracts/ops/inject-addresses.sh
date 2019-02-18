#!/bin/bash
set -e

targets="ECTools ChannelManager"

function cleanup {
  for target in $targets
  do
    artifacts=build/contracts/$target.json
    backup=build/contracts/$target.backup.json
    if [[ -f "$backup" ]]
    then rm $artifacts && mv $backup $artifacts
    fi
  done
}
trap cleanup EXIT

for target in $targets
do
  artifacts=build/contracts/$target.json
  backup=build/contracts/$target.backup.json
  mv $artifacts $backup
  jq -s ".[0].$target * .[1]" ops/address-book.json $backup > $artifacts
  rm $backup
done

