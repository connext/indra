#!/bin/bash
set -e

project=connext
key_name=private_key
name=${project}_migrator

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
if [[ -n "`docker secret ls | grep " $key_name"`" ]]
then
  echo "A secret called $key_name already exists, skipping key load"
  echo "Remove existing secret to reset: docker secret rm $key_name"

else 
  # Prepare to set or use our user's password
  echo "Copy the hub's private key to your clipboard"
  echo "Paste it below & hit enter"
  echo -n "> "
  read -s key
  echo

  id="`echo $key | tr -d ' \n\r' | docker secret create $key_name -`"
  if [[ "$?" == "0" ]]
  then echo "Successfully loaded private key into secret store"
       echo "name=$key_name id=$id"
  else echo "Something went wrong creating secret called $key_name"
  fi
fi

########################################
# Make everything that we need

echo
make ethprovider-prod

########################################
# Remove the migration service when we're done

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
echo "Deploying contract migrator..."
echo

docker service create \
  --detach \
  --name="$name" \
  --env="ETH_MNEMONIC=$ETH_MNEMONIC" \
  --env="ETH_NETWORK=$ETH_NETWORK" \
  --env="ETH_PROVIDER=$ETH_PROVIDER" \
  --env="INFURA_KEY=$INFURA_KEY" \
  --env="PRIVATE_KEY_FILE=$PRIVATE_KEY_FILE" \
  --mount="type=volume,source=connext_chain_dev,target=/data" \
  --mount="type=bind,source=`pwd`/modules/contracts,target=/root" \
  --restart-condition=none \
  --secret private_key \
  ${project}_ethprovider

docker service logs --raw --follow $name &
logs_pid=$!

# Wait for the first migrator container to exit..
while [[ -z "`docker container ls -a | grep "$name" | grep "Exited"`" ]]
do sleep 1
done
sleep 1
