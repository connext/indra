#!/bin/bash
set -e

echo "Ethprovider entrypoint activated!"

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )/.."
ganache="$dir/node_modules/.bin/ganache-cli"
address_book="$dir/address-book.json"

mkdir -p /data

if [[ "$1" == "start" ]]
then
  echo "Starting Ganache.."
  exec $ganache \
    --db="/data" \
    --gasPrice="10000000000" \
    --host="0.0.0.0" \
    --mnemonic="$ETH_MNEMONIC" \
    --networkId="1337" \
    --port="8545" \
    --defaultBalanceEther="1000000000"

elif [[ "$1" == "deploy" ]]
then
  if [[ "${ETH_PROVIDER#*://}" == "localhost"* ]]
  then
    echo "Starting Ganache.."
    $ganache \
      --db="/data" \
      --gasPrice="10000000000" \
      --host="0.0.0.0" \
      --mnemonic="$ETH_MNEMONIC" \
      --networkId="1337" \
      --port="8545" \
      --defaultBalanceEther="1000000000" \
       > $dir/.ganache.log &
    wait-for localhost:8545
  fi

  touch $address_book

  echo "Deploying contracts.."
  node dist/src.ts/cli.js migrate \
    --address-book "$address_book" \
    --eth-provider "$ETH_PROVIDER" \
    --mnemonic "$ETH_MNEMONIC"

  echo "Deploying testnet token.."
  node dist/src.ts/cli.js new-token \
    --address-book "$address_book" \
    --eth-provider "$ETH_PROVIDER" \
    --mnemonic "$ETH_MNEMONIC"

else
  echo "Exiting. No command given, expected: start or deploy"
fi
