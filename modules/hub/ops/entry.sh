#!/bin/bash
set -e

bash ops/wait-for-it.sh 127.0.0.1:5432

node ./dist/src/spankchain/main.js chainsaw &
node ./dist/src/spankchain/main.js
