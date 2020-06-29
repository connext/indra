#!/usr/bin/env bash
set -e

INDRA_ETH_RPC_URL="${INDRA_ETH_RPC_URL:-http://172.17.0.1:3000/api/ethprovider}"
INDRA_NODE_URL="${INDRA_NODE_URL:-http://172.17.0.1:3000/api}"
INDRA_NATS_URL="${INDRA_NATS_URL:-nats://172.17.0.1:4222}"
BOT_REGISTRY_URL="${BOT_REGISTRY_URL:-http://172.17.0.1:3333}"

echo "Bot registry container launched!"

function finish {
  echo && echo "Bot container exiting.." && exit
}

trap finish SIGTERM SIGINT
echo "Launching registry!";echo
npm run start:registry
