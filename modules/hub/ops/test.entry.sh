#!/bin/bash

project=connext

export DATABASE="database:5432"
export REDIS="redis:6379"
export ETH_RPC_URL="ethprovider:8545"
export DATABASE_URL="postgresql://$project:$project@$DATABASE/test_$project"
export REDIS_URL="redis://$REDIS"

ops/wait-for-it.sh $REDIS
ops/wait-for-it.sh $DATABASE
ops/wait-for-it.sh $ETH_RPC_URL
sleep 10 && ops/wait-for-it.sh $DATABASE # just to be safe..

mocha -r ./dist/register/common.js -r ./dist/register/testing.js "dist/**/*.test.js" --exit
