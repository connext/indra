#!/bin/bash

echo "Wallet entrypoint activated!"

if [[ "$1" == "yes" ]]
then
  echo "Client watcher activated"
  cd ../client
  ./node_modules/.bin/tsc --preserveWatchOutput --watch &
else echo "not watching client source, turn this on in deploy.dev.sh if desired"
fi

# Start wallet react app
echo "Starting wallet dev server..."
cd /root
exec npm start
