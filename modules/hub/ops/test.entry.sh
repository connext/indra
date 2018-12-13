#!/bin/bash

export ETH_RPC_URL="ethprovider:8545"
export DATABASE_URL="database:5432"
export REDIS_URL="redis:6379"

mocha -r ./dist/register/common.js -r ./dist/register/testing.js "dist/**/*.test.js" --exit
