#!/bin/bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"

echo "Ethereum testnet entrypoint activated!"

if [[ -d "modules/contracts" ]]
then cd modules/contracts
fi

address_book="${ADDRESS_BOOK:-/tmpfs/address-book.json}"
data_dir="${DATA_DIR:-/data}"
chain_id="${CHAIN_ID:-1337}"
mnemonic="${MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"
eth_provider="${ETH_PROVIDER:-http://localhost:8545}"
engine="${ENGINE:-buidler}"

mkdir -p $data_dir /data /tmpfs
touch $address_book

# TODO: the gasLimit shouldn't need to be 1000x higher than mainnet but cf tests fail otherwise..

if [[ "$engine" == "buidler" ]]
then
  echo "Using buidler EVM engine"  
  echo 'module.exports = {
    defaultNetwork: "buidlerevm",
    networks: {
      buidlerevm: {
        chainId: '$chain_id',
        loggingEnabled: false,
        accounts: { mnemonic: "'$mnemonic'" },
        blockGasLimit: "9000000000",
        gasPrice: "1000000000",
      },
    },
  }' > buidler.config.js

  launch="
    $dir/node_modules/.bin/buidler node
      --hostname 0.0.0.0
      --port 8545
  "

else
  echo "Using ganache EVM engine"  
  launch="
    $dir/node_modules/.bin/ganache-cli
      --db="$data_dir" \
      --defaultBalanceEther="1000000000" \
      --gasLimit="9000000000" \
      --gasPrice="1000000000" \
      --host="127.0.0.1" \
      --mnemonic="$mnemonic" \
      --networkId="$chain_id" \
      --port="8545" \
  "
fi

echo "Starting isolated testnet to migrate contracts.."
$launch > /dev/null &
pid=$!

wait-for localhost:8545

# Because stupid ganache hardcoded it's chainId, prefer this env var over ethProvider.getNetwork()
export REAL_CHAIN_ID=$chain_id

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

kill $pid

echo "Starting publically available testnet.."
exec $launch
