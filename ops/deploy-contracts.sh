#!/bin/bash
set -e

project="indra"
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
docker swarm init 2> /dev/null || true

ETH_MNEMONIC_FILE=${project}_mnemonic_$ETH_NETWORK
if [[ "$ETH_NETWORK" != "ganache" ]]
then
  # Sanity check: does this secret already exist?
  if [[ -n "`docker secret ls | grep " $ETH_MNEMONIC_FILE"`" ]]
  then
    echo "A secret called $ETH_MNEMONIC_FILE already exists"
    echo "Remove existing secret to reset: docker secret rm $ETH_MNEMONIC_FILE"
  else
    echo "Copy your $ETH_MNEMONIC_FILE secret to your clipboard"
    echo "Paste it below & hit enter (no echo)"
    echo -n "> "
    read -s secret
    echo

    id="`echo $secret | tr -d '\n\r' | docker secret create $ETH_MNEMONIC_FILE -`"
    if [[ "$?" == "0" ]]
    then echo "Successfully loaded secret into secret store"
         echo "name=$ETH_MNEMONIC_FILE id=$id"
    else echo "Something went wrong creating secret called $ETH_MNEMONIC_FILE"
    fi
  fi
fi

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
then SECRET_ENV="--env=ETH_MNEMONIC_FILE=/run/secrets/$ETH_MNEMONIC_FILE --secret=$ETH_MNEMONIC_FILE"
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
    --mount="type=volume,source=`pwd`/ops/ganache.logs,target=/root/ganache.logs" \
    --mount="type=volume,source=`pwd`/address-book.json,target=/root/address-book.json" \
    --restart-condition="none" \
    $SECRET_ENV \
    ${project}_ethprovider
`"

echo "Success! Deployer service started with id: $id"
echo

docker service logs --raw --follow $name &
logs_pid=$!

# Wait for the deployer to exit..
while [[ -z "`docker container ls -a | grep "$name" | grep "Exited"`" ]]
do sleep 1
done
