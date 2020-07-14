#!/bin/bash
set -e

echo "Ganache entrypoint activated!"

if [[ -d "modules/contracts" ]]
then cd modules/contracts
fi

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )/.."
ganache="$dir/node_modules/.bin/ganache-cli"
address_book="$dir/address-book.json"

data_dir="${DATA_DIR:-/data}"
chain_id="${CHAIN_ID:-1337}"
mnemonic="${MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"
eth_provider="${ETH_PROVIDER:-http://172.17.0.1:8545}"

mkdir -p $data_dir

# TODO: the gasLimit shouldn't need to be 1000x higher than mainnet but cf tests fail otherwise..

if [[ "$1" == "start" ]]
then
  echo "Starting Ganache.."
  exec $ganache \
    --db="$data_dir" \
    --gasLimit="9000000000" \
    --gasPrice="1000000000" \
    --host="0.0.0.0" \
    --mnemonic="$mnemonic" \
    --networkId="$chain_id" \
    --port="8545" \
    --defaultBalanceEther="1000000000"

elif [[ "$1" == "deploy" ]]
then
  if [[ "${eth_provider#*://}" == "localhost"* ]]
  then
    echo "Starting Ganache.."
    $ganache \
      --db="$data_dir" \
      --gasLimit="9000000000" \
      --gasPrice="1000000000" \
      --host="0.0.0.0" \
      --mnemonic="$mnemonic" \
      --networkId="$chain_id" \
      --port="8545" \
      --defaultBalanceEther="1000000000" \
       > $dir/.ganache.log &
    wait-for localhost:8545
  fi

  touch $address_book

  echo "Deploying contracts.."
  node dist/src.ts/cli.js migrate \
    --address-book "$address_book" \
    --eth-provider "$eth_provider" \
    --mnemonic "$mnemonic"

  echo "Deploying testnet token.."
  node dist/src.ts/cli.js new-token \
    --address-book "$address_book" \
    --eth-provider "$eth_provider" \
    --mnemonic "$mnemonic"

else
  echo "Exiting. No command given, expected: start or deploy"
fi
