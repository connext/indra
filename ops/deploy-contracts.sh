#!/bin/bash
set -e

# Make sure docker swarm mode is enabled so we can use the secret store
docker swarm init 2> /dev/null || true

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $dir/../package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

# Constants
ganacheId="4447"
localProvider="http://localhost:8545"

# Command line args
ETH_PROVIDER="${1:-$localProvider}"

# Env vars
mode="${MODE:-local}"

########################################
# Calculate stuff based on env

cwd="`pwd`"

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

if [[ "$chainId" == "$ganacheId" ]]
then
  SECRET_ENV="--env=ETH_MNEMONIC=candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
else
  echo "Copy the mnemonic for an account that holds funds on chain $chainId to your clipboard"
  echo "Paste it below & hit enter (no echo)"
  echo -n "> "
  read -s secret
  SECRET_ENV="--env=ETH_MNEMONIC=$secret"
  echo
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
    "$SECRET_ENV" \
    --entrypoint="bash" \
    --env="ETH_PROVIDER=$ETH_PROVIDER" \
    --mount="type=bind,source=$cwd,target=/root" \
    --mount="type=volume,source=${project}_chain_dev,target=/data" \
    --name="$name" \
    --rm \
    ${project}_builder -c "cd modules/contracts && bash ops/entry.sh deploy"

elif [[ "$mode" == "release" ]]
then image="${project}_ethprovider:$release"
elif [[ "$mode" == "staging" ]]
then image="${project}_ethprovider:$commit"
else image="${project}_ethprovider:latest"
fi

echo "Deploying $mode-mode contract deployer (image: $image)..."

exec docker run \
  $interactive \
  "$SECRET_ENV" \
  --env="ETH_PROVIDER=$ETH_PROVIDER" \
  --mount="type=bind,source=$address_book,target=/root/address-book.json" \
  --mount="type=volume,source=${project}_chain_dev,target=/data" \
  --name="$name" \
  --rm \
  $image deploy
