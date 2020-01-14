#!/bin/bash
set -e

echo "Ethprovider entrypoint activated!"

if [[ "$1" == "start" ]]
then
  echo "Starting Ganache.."
  mkdir -p /data
  exec ganache-cli \
    --db="/data" \
    --gasPrice="10000000000" \
    --host="0.0.0.0" \
    --mnemonic="$ETH_MNEMONIC" \
    --networkId="4447" \
    --port="8545" \
    --defaultBalanceEther="1000000000" # default 1bil ETH to each account $$$
elif [[ "$1" == "deploy" ]]
then
  echo "Deploying contracts.."
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
      --defaultBalanceEther="1000000000" \
       > ganache.log &
    bash wait-for.sh localhost:8545 2> /dev/null
  fi
  touch address-book.json
  node contracts/ops/migrate-contracts.js
else
  echo "Exiting. No command given, expected: start or deploy"
fi
