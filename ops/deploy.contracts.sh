#!/bin/bash
set -e

project=connext
key_name=private_key

########################################
# Verify env vars

if [[ -n "$1" ]]
then network="$1"
elif [[ -z "$ETH_NETWORK" ]]
then network="$ETH_NETWORK"
else
  echo "Expected to see \$ETH_NETWORK passed as an arg or env var (eg \"rinkeby\"), aborting"
  exit
fi

if [[ -z "$ETH_PROVIDER" && -z "$API_KEY" ]]
then
  echo "Expected to see either an \$ETH_PROVIDER or \$API_KEY env var, aborting"
  exit
fi

########################################
# Load private key into secret store

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

make ethprovider-prod

########################################
# Deploy contracts
docker service create \
  --tty --interactive \
  --name="${project}_contractor_migrator" \
  --env="API_KEY=$API_KEY" \
  --env="ETH_PROVIDER=$ETH_PROVIDER" \
  --env="ETH_NETWORK=$ETH_NETWORK" \
  --mount="type=volume,source=`pwd`/modules/contracts,target=/root" \
  --restart-condition=none \
  --secret private_key \
  ${project}_ethprovider
