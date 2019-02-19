#!/bin/bash
set -e

project=connext
key_name=private_key
name=${project}_contract_deployer
cwd="`pwd`"

########################################
# Setup env vars

INFURA_KEY=$INFURA_KEY

if [[ -n "$1" ]]
then ETH_NETWORK="$1"
elif [[ -n "$ETH_NETWORK" ]]
then ETH_NETWORK="$ETH_NETWORK"
else ETH_NETWORK="ganache"
fi

if [[ -z "$ETH_PROVIDER" || "$ETH_NETWORK" == "ganache" ]]
then ETH_PROVIDER="http://localhost:8545"
fi

if [[ -z "$ETH_MNEMONIC" ]]
then ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
fi

echo "Deploying contracts to $ETH_NETWORK via provider: $ETH_PROVIDER"
sleep 1 # give the user a sec to ctrl-c in case above is wrong

########################################
# Load private key into secret store

echo
echo "Load the Hub's private key into the secret store"
bash ops/load-secret.sh $key_name

########################################
# Make everything that we need

echo
make contract-artifacts

########################################
# Remove this deployer service when we're done

function cleanup {
  echo
  echo "Contract deployment complete, removing service:"
  docker service remove $name 2> /dev/null || true
  kill $logs_pid
  echo "Done!"
}
trap cleanup EXIT

########################################
# Deploy contracts

echo
echo "Deploying contract deployer..."

id="`
docker service create \
  --detach \
  --name="$name" \
  --env="ETH_MNEMONIC=$ETH_MNEMONIC" \
  --env="ETH_NETWORK=$ETH_NETWORK" \
  --env="ETH_PROVIDER=$ETH_PROVIDER" \
  --env="INFURA_KEY=$INFURA_KEY" \
  --env="PRIVATE_KEY_FILE=$PRIVATE_KEY_FILE" \
  --mount="type=volume,source=connext_chain_dev,target=/data" \
  --mount="type=bind,source=$cwd/modules/contracts,target=/root" \
  --restart-condition=none \
  --secret private_key \
  --entrypoint "bash ops/entry.sh" \
  ${project}_builder:dev 2> /dev/null
`"
echo "Success! Deployer service started with id: $id"
echo

docker service logs --raw --follow $name &
logs_pid=$!

# Wait for the deployer to exit..
while [[ -z "`docker container ls -a | grep "$name" | grep "Exited"`" ]]
do sleep 1
done
sleep 1
