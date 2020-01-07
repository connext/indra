#!/usr/bin/env bash
set -e

version="${1:-latest}"

exec docker run \
  --env="INDRA_CLIENT_LOG_LEVEL=$LOG_LEVEL" \
  --env="INDRA_ETH_RPC_URL=$ETH_RPC_URL" \
  --env="INDRA_NODE_URL=$NODE_URL" \
  --interactive \
  --name="indra_test_runner" \
  --rm \
  --tty \
  indra_test_runner:$version "$@"
