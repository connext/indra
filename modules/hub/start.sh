#!/usr/bin/env bash

trap 'kill $(jobs -p)' EXIT

yarn clean && yarn build:backend
ssh -f matthewslipper@35.188.243.45 -L 8545:localhost:8545 -N
REDIS_URL='redis://localhost:6379' DATABASE_URL='postgresql://localhost:5432/spank_hub' WALLET_ADDRESS='0xbb1699d16368ebc13bdc29e6a1aad50a21be45eb' node ./dist/spankchain/main.js chainsaw
