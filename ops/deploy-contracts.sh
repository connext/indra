#!/bin/bash
set -e

# Make sure docker swarm mode is enabled so we can use the secret store
docker swarm init 2> /dev/null || true

########################################
# Setup env

# Constants
ganacheId="4447"
localProvider="http://localhost:8545"
registry="connextproject"

# Command line args
ETH_PROVIDER="${1:-$localProvider}"

# Env vars
mode="${MODE:-local}"

########################################
# Calculate stuff based on env

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | jq .name | tr -d '"'`"
cwd="`pwd`"
log="$cwd/.ganache.log"

commit="`git rev-parse HEAD | head -c 8`"
release="`cat package.json | grep '"version":' | awk -F '"' '{print $4}'`"
name=${project}_contract_deployer

chainId="`curl -q -k -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"net_version","params":[]}' $ETH_PROVIDER | jq .result | tr -d '"'`"

if [[ -z "$chainId" ]]
then
  if [[ "$ETH_PROVIDER" == "$localProvider" ]]
  then chainId="$ganacheId"
  else echo "Unable to retrieve chainId from provider: $ETH_PROVIDER" && exit 1
  fi
fi

if [[ -f "$cwd/address-book.json" ]]
then address_book="$cwd/address-book.json"
else address_book="$cwd/modules/contracts/address-book.json"
fi

echo "Deploying contracts to chain $chainId via provider: $ETH_PROVIDER"
sleep 1

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
echo

########################################
# Load private key into secret store
# Unless we're using ganache, in which case we'll use the ETH_MNEMONIC

ETH_MNEMONIC_FILE=${project}_mnemonic_$chainId
if [[ "$chainId" == "$ganacheId" ]]
then
  SECRET_ENV="--env=ETH_MNEMONIC=candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
else
  SECRET_ENV="--env=ETH_MNEMONIC_FILE=/run/secrets/$ETH_MNEMONIC_FILE --secret=$ETH_MNEMONIC_FILE"
  # Sanity check: does this secret already exist?
  if [[ -n "`docker secret ls | grep " $ETH_MNEMONIC_FILE"`" ]]
  then
    echo "A secret called $ETH_MNEMONIC_FILE already exists"
    echo "Remove existing secret to reset: docker secret rm $ETH_MNEMONIC_FILE"
  else
    echo "Copy your $ETH_MNEMONIC_FILE secret for chain $chainId to your clipboard"
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
# Deploy contracts

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

if [[ "$mode" == "local" && "$chainId" == "$ganacheId" ]]
then
  echo "Deploying $mode-mode contract deployer (image: builder)..."
  exec docker run \
    $interactive \
    --entrypoint="bash" \
    --name="$name" \
    "$SECRET_ENV" \
    --env="ETH_PROVIDER=$ETH_PROVIDER" \
    --mount="type=volume,source=${project}_chain_dev,target=/data" \
    --mount="type=bind,source=$cwd,target=/root" \
    --rm \
    ${project}_builder -c "cd modules/contracts && bash ops/entry.sh deploy"

elif [[ "$mode" == "release" ]]
then image="${project}_ethprovider:$release"
elif [[ "$mode" == "staging" ]]
then image="${project}_ethprovider:$commit"
else image="${project}_ethprovider:latest"
fi

echo "Deploying $mode-mode contract deployer (image: $image)..."

if [[ "`docker image ls -q $image`" == "" ]]
then
  echo "Image $image does not exist locally, trying $registry/$image"
  image=$registry/$image
  if [[ "`docker image ls -q $image`" == "" ]]
  then docker pull $image || (echo "Image does not exist" && exit 1)
  fi
fi

touch $log
id="`
  docker service create \
    --detach \
    --name="$name" \
    --env="ETH_PROVIDER=$ETH_PROVIDER" \
    --mount="type=volume,source=${project}_chain_dev,target=/data" \
    --mount="type=bind,source=$log,target=/root/ganache.log" \
    --mount="type=bind,source=$address_book,target=/root/address-book.json" \
    --restart-condition="none" \
    "$SECRET_ENV" \
    $image deploy 2> /dev/null
`"

echo "Success! Deployer service started with id: $id"
echo

docker service logs --raw --follow $name &
logs_pid=$!

# Wait for the deployer to exit..
while [[ -z "`docker container ls -a | grep "$name" | grep "Exited"`" ]]
do sleep 1
done
