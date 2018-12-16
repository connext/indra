#!/bin/bash

export DATABASE="$POSTGRES_HOST:5432"
export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$DATABASE/$POSTGRES_DB"
export REDIS="$REDIS_HOST:6379"
export REDIS_URL="redis://$REDIS"
export ETH_RPC_URL="$ETHPROVIDER_HOST:8545"

ops/wait-for-it.sh -t 60 $POSTGRES_HOST:5433
ops/wait-for-it.sh -t 60 $DATABASE
ops/wait-for-it.sh -t 60 $REDIS
ops/wait-for-it.sh -t 60 $ETH_RPC_URL

./node_modules/.bin/mocha -r ./dist/register/common.js -r ./dist/register/testing.js "dist/**/*.test.js" --exit
