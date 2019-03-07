#!/bin/bash
set -e

targets="ECTools ChannelManager"

for target in $targets
do
  artifacts=build/contracts/$target.json
  backup=build/contracts/$target.backup.json
  mv $artifacts $backup
  jq -s ".[0].$target * .[1]" ops/addresses.json $backup > $artifacts
  rm $backup
done

