#!/bin/bash

project=connext
key_name=private_key
name=${project}_migrator

########################################
# Verify env vars

if [[ -n "$1" ]]
then network="$1"
elif [[ -n "$ETH_NETWORK" ]]
then network="$ETH_NETWORK"
else network="ganache"
fi

if [[ -z "$ETH_PROVIDER" && -z "$API_KEY" ]]
then
  echo "Expected to see either an \$ETH_PROVIDER or \$API_KEY env var, aborting"
  exit
fi

echo "Deploying contracts to $network via provider: $ETH_PROVIDER"
sleep 1 # give the user a sec to ctrl-c in case above is wrong

# Remove the migration service when we're done
function cleanup {
  echo
  echo "Contract deployment complete, removing service:"
  docker service remove $name 2> /dev/null || true
  echo "Done!"
}
trap cleanup EXIT

########################################
# Load private key into secret store

echo
if [[ -n "`docker secret ls | grep " $key_name"`" ]]
then
  echo "A secret called $key_name already exists, skipping key load"
  echo "Remove existing secret with: docker secret rm $key_name"

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
# Deploy contracts

echo
echo "Deploying contract migrator..."
echo

docker service create \
  --detach \
  --name="$name" \
  --env="API_KEY=$API_KEY" \
  --env="ETH_PROVIDER=$ETH_PROVIDER" \
  --env="ETH_NETWORK=$ETH_NETWORK" \
  --mount="type=volume,source=connext_chain_dev,target=/data" \
  --mount="type=bind,source=`pwd`/modules/contracts,target=/root" \
  --restart-condition=none \
  --secret private_key \
  ${project}_ethprovider

docker service logs --follow $name &

# Wait for the migrator container to exit..
while [[ -z "`docker container ls -a | grep "$name" | grep "Exited"`" ]]
do sleep 1
done
