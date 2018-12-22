#!/bin/bash

echo "Wallet entrypoint activated"

# Add "connext" to yarn links
cd /client && echo "cwd=`pwd`"
yarn link

# Link "connext" into current project
cd $HOME && echo "cwd=`pwd`"
yarn link connext

# Start typescript watcher in background
tsc --watch --preserveWatchOutput --project tsconfig.json &

# Start wallet react app
yarn start
