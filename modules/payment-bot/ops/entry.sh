#!/bin/bash
set -e

project="indra"
cwd="`pwd`"
args="$@"

echo "Starting payment bot with args: $args"

identifier=1
while [ "$1" != "" ]; do
  case $1 in
    -i | --identifier ) shift
                        identifier=$1
                        ;;
  esac
  shift
done

if [[ "$identifier" == 1 ]]
then mnemonic="humble sense shrug young vehicle assault destroy cook property average silent travel"
elif [[ "$identifier" == 2 ]]
then mnemonic="roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult"
fi

echo "Processed args, got id $identifier and mnemonic $mnemonic"

export DB_FILENAME="${DB_FILENAME:-.payment-bot-db/$identifier.json}"
export ECCRYPTO_NO_FALLBACK=true
export ETH_RPC_URL="${ETH_RPC_URL:-http://172.17.0.1:8545}"
export NODE_URL="${NODE_URL:-nats://172.17.0.1:4222}"
export PISA_CONTRACT_ADDRESS="${PISA_CONTRACT_ADDRESS:-0x0000000000000000000000000000000000000000}"
export PISA_URL="${PISA_URL:-http://172.17.0.1:5487}"
export WEBDIS_URL="${REDIS_URL:-redis://172.17.0.1:6379}"
export MNEMONIC="${MNEMONIC:-$mnemonic}"

bash ops/wait-for.sh ${ETH_RPC_URL#*://}

if [[ -d modules/payment-bot ]]
then cd modules/payment-bot
fi
mkdir -p ${DB_FILENAME%/*}
touch $DB_FILENAME
node dist/index.js "$args"
