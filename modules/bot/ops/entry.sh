#!/usr/bin/env bash
set -e

if [[ -d "modules/bot" ]]
then cd modules/bot
fi

node dist/cli.js $@
