#!/usr/bin/env bash
set -e

here="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $here/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

chain_port_1="${INDRA_PORT_1:-8545}"
chain_id_1="${INDRA_CHAIN_ID_1:-1337}"
chain_port_2="${INDRA_PORT_2:-8546}"
chain_id_2="${INDRA_CHAIN_ID_2:-1338}"
eth_mnemonic="${INDRA_MNEMONIC:-candy maple cake sugar pudding cream honey rich smooth crumble sweet treat}"

########################################
# Configure or launch Ethereum testnets

chain_url_1="http://172.17.0.1:$chain_port_1"
chain_host_1="${project}_testnet_$chain_id_1"

chain_url_2="http://172.17.0.1:$chain_port_2"
chain_host_2="${project}_testnet_$chain_id_2"

chain_providers='{"'$chain_id_1'":"'$chain_url_1'","'$chain_id_2'":"'$chain_url_2'"}'

echo "Starting $chain_host_1 & $chain_host_2.."
export INDRA_MNEMONIC=$eth_mnemonic

# NOTE: Start script for buidler testnet will return before it's actually ready to go.
# Run buidlerevm first so that it can finish while we're waiting for ganache to get set up
export INDRA_TAG=$chain_tag_2
export INDRA_EVM=buidler
bash ops/start-chain.sh $chain_id_2 $chain_port_2

export INDRA_TAG=$chain_tag_1
export INDRA_EVM=ganache
bash ops/start-chain.sh $chain_id_1 $chain_port_1

# Pull the tmp address books out of each chain provider & merge them into one
address_book_1=`docker exec $chain_host_1 cat /tmpfs/address-book.json`
address_book_2=`docker exec $chain_host_2 cat /tmpfs/address-book.json`
eth_contract_addresses=`echo $address_book_1 $address_book_2 | jq -s '.[0] * .[1]'`

# output: $eth_contract_addresses, $chain_url_1
