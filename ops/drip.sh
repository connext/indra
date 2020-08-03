#!/bin/bash
set -e

# Get env vars (defaults correspond to ganache funder)
private_key="${1:-"0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"}"
provider="${2:-"http://localhost:8545"}"
address_book="${3:-"./modules/contracts/address-book.json"}"

node modules/contracts/dist/src.ts/cli.js drip --private-key="$private_key" --eth-provider="$provider" --address-book="$address_book"
