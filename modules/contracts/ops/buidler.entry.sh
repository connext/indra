#!/bin/bash
set -e

echo "Buidler entrypoint activated!"

if [[ -d "modules/contracts" ]]
then cd modules/contracts
fi

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )/.."
address_book="$dir/address-book.json"

mkdir -p /data

if [[ "$1" == "start" ]]
then
  echo "Starting BuidlerEVM.."
  exec npx buidler node --hostname 0.0.0.0 --port 8545

elif [[ "$1" == "deploy" ]]
then
  if [[ "${ETH_PROVIDER#*://}" == "localhost"* ]]
  then
    echo "Starting BuidlerEVM for deployment.."
    npx buidler node --hostname 0.0.0.0 --port 8545 > $dir/.buidlerevm.log &
    wait-for localhost:8546
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
