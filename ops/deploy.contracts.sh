#!/bin/bash
set -e

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"
name=${project}_contract_deployer
cwd="`pwd`"

########################################
# Setup env vars

INFURA_KEY=$INFURA_KEY

if [[ -n "$1" ]]
then ETH_NETWORK="$1"
else ETH_NETWORK="${ETH_NETWORK:-ganache}"
fi

if [[ "$ETH_NETWORK" == "ganache" ]]
then ETH_PROVIDER="http://localhost:8545"
fi

if [[ -z "$ETH_MNEMONIC" ]]
then ETH_MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
fi

if [[ -z "$ETH_PROVIDER" && -n "$INFURA_KEY" ]]
then echo "Deploying contracts to $ETH_NETWORK via Infura"
elif [[ -n "$ETH_PROVIDER" ]]
then echo "Deploying contracts to $ETH_NETWORK via provider: $ETH_PROVIDER"
else echo "Please set either an ETH_PROVIDER or INFURA_KEY env var to deploy" && exit
fi

sleep 1 # give the user a sec to ctrl-c in case above is wrong

########################################
# Load private key into secret store
# Unless we're using ganache, in which case we'll use the ETH_MNEMONIC

# Docker swarm mode needs to be enabled to use the secret store
docker swarm init "--advertise-addr=\$privateip" 2> /dev/null || true

PRIVATE_KEY_FILE=hub_key_$ETH_NETWORK
if [[ "$ETH_NETWORK" != "ganache" ]]
then
  echo
  echo "Load the Hub's private key for $ETH_NETWORK into the secret store"
  bash ops/load-secret.sh $PRIVATE_KEY_FILE
fi

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
  if [[ -n "$logs_pid" ]]
  then kill $logs_pid
  fi
  echo "Done!"
}
trap cleanup EXIT

########################################
# Deploy contracts

if [[ "$ETH_NETWORK" != "ganache" ]]
then SECRET_ENV="--env=PRIVATE_KEY_FILE=/run/secrets/$PRIVATE_KEY_FILE --secret=$PRIVATE_KEY_FILE"
fi

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
  --mount="type=volume,source=${project}_chain_dev,target=/data" \
  --mount="type=bind,source=$cwd/modules/contracts,target=/root" \
  --restart-condition="none" \
  $SECRET_ENV \
  --entrypoint "bash ops/entry.sh" \
  ${project}_builder 2> /dev/null
`"
echo "Success! Deployer service started with id: $id"
echo

docker service logs --raw --follow $name &
logs_pid=$!

# Wait for the deployer to exit..
while [[ -z "`docker container ls -a | grep "$name" | grep "Exited"`" ]]
do sleep 1
done
