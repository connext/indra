#!/bin/env bash
set -e

target=$1

# First, use typedoc to generate a JSON file containing type information

typedoc \
  --mode file \
  --excludeNotExported \
  --excludePrivate \
  --json docs/typedoc/$target.json \
  --tsconfig modules/$target/tsconfig.json \
  modules/$target/src/index.ts

# Second, use handlebars to substitute info from typedoc json into markdown templates

ts-node \
  --compiler-options '{"module": "commonjs"}' \
  docs/handlebars.ts $target
