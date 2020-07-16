#!/bin/bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

chain_url="${1:-http://localhost:8545}"
mode="${MODE:-local}"
echo chain provider url: $chain_url

########################################
# Calculate stuff based on env

commit="`git rev-parse HEAD | head -c 8`"
release="`cat package.json | grep '"version":' | awk -F '"' '{print $4}'`"
name=${project}_contract_deployer

if [[ -f "$root/address-book.json" ]]
then address_book="$root/address-book.json"
else address_book="$root/modules/contracts/address-book.json"
fi

########################################
# Get mnemonic

chain_host="${chain_url#*://}"
chain_host="${chain_host%/*}"
chain_port="${chain_host#*:}"

if [[ "$chain_url" == "http://localhost:"* && -n `docker container ls -f publish=8545 | grep "0.0.0.0:$chain_port" | grep "indra_"` ]]
then mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
else
  echo "Copy the mnemonic for the account that will pay for gas"
  echo "Paste it below & hit enter (no echo)"
  echo -n "> "
  read -s mnemonic
  SECRET_ENV="$secret"
  echo
fi

########################################
# Deploy contracts

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

if [[ "$mode" == "local" ]]
then
  image=${project}_builder
  echo "Deploying $mode-mode contract deployer (image: $image)..."
  docker run \
    $interactive \
    --entrypoint="bash" \
    --env=ETH_MNEMONIC="$mnemonic" \
    --env=ETH_PROVIDER="`echo $chain_url | sed 's/localhost/172.17.0.1/'`" \
    --mount="type=bind,source=$root,target=/root" \
    --mount="type=bind,source=$address_book,target=/data/address-book.json" \
    --name="$name" \
    --rm \
    $image modules/contracts/ops/deploy.sh
  exit

elif [[ "$mode" == "release" ]]
then image="${registry}/${project}_ethprovider:$release"
elif [[ "$mode" == "staging" ]]
then image="${project}_ethprovider:$commit"
fi

echo "Deploying $mode-mode contract deployer (image: $image)..."

docker run \
  $interactive \
  --env=ETH_MNEMONIC="$mnemonic" \
  --env=ETH_PROVIDER="`echo $chain_url | sed 's/localhost/172.17.0.1/'`" \
  --mount="type=bind,source=$address_book,target=/data/address-book.json" \
  --name="$name" \
  --rm \
  $image deploy
