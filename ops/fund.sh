#!/bin/bash
set -e

recipient="$1"
amount="${2:-1}"
token="$3" # defaults to using eth if no token address provided

node modules/contracts/dist/src.ts/cli.js fund --to-address="$recipient" --amount="$amount" --token-address="$token"
