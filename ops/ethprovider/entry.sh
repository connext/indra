#!/bin/bash
set -e

echo "Ethprovider entrypoint activated!"

if [[ "$ETH_NETWORK" == "ganache" ]]
then
  echo "Starting Ganache.."
  mkdir -p /data
  ganache-cli \
    --db="/data" \
    --gasPrice="10000000000" \
    --host="0.0.0.0" \
    --mnemonic="$ETH_MNEMONIC" \
    --networkId="4447" \
    --port="8545" \
     > ganache.log &
  bash wait-for.sh localhost:8545 2> /dev/null
fi

touch address-book.json
node migrate-contracts.js
