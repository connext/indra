#!/usr/bin/env bash

bash ops/stop.sh

if [[ "$1" == "prod" ]]
then bash ops/deploy.prod.sh
else bash ops/deploy.dev.sh
fi
