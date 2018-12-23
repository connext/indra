#!/bin/bash

hub="hub:8080"
ethprovider="ethprovider:8545"

echo "Wallet entrypoint activated!"
echo "Setting up yarn links.."
cd /client && echo "cwd=`pwd`"
yarn link
cd $HOME && echo "cwd=`pwd`"
yarn link connext

# Start typescript watcher in background
./node_modules/.bin/tsc --watch --preserveWatchOutput --project tsconfig.json &

# Wait for hub & ethprovider to wake up
echo "Waiting for $hub and $ethprovider to wake up.."
bash /ops/wait-for.sh -t 60 $hub 2> /dev/null
bash /ops/wait-for.sh -t 60 $ethprovider 2> /dev/null

# Start wallet react app
echo "Starting wallet dev server.."
yarn start
