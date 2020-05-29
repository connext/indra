#!/bin/bash
set -e

recipient="$1"

node modules/contracts/dist/src.ts/cli.js fund --to-address="$recipient" --amount="0.05"
