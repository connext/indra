#!/usr/bin/env bash
set -e

echo "Bot registry container launched!"

function finish {
  echo && echo "Bot container exiting.." && exit
}

trap finish SIGTERM SIGINT
echo "Launching registry!";echo
npm run start:registry
