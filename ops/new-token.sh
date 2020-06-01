#!/bin/bash
set -e

node modules/contracts/dist/src.ts/cli.js new-token --address-book="modules/contracts/address-book.json"

