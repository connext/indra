#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
tag="cf_tester"

cmd="${1:-test}"
shift || true # $1 is the command to npm run. Extra options, if any, come after

########################################
# Start testnet & stop it when we're done

ethprovider_host="${project}_testnet_$tag"
ethprovider_port="8547"
ethprovider_chain_id="1339"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

# Kill the dependency containers when this script exits
function cleanup {
  echo "Tests finished, stopping testnet.."
  docker container stop $ethprovider_host 2> /dev/null || true
}
trap cleanup EXIT SIGINT SIGTERM

echo "Starting $ethprovider_host.."
export INDRA_TESTNET_DATA_DIR=/tmpfs
export INDRA_TESTNET_PORT=$ethprovider_port
export INDRA_TESTNET_MNEMONIC=$eth_mnemonic
bash ops/start-eth-provider.sh $ethprovider_chain_id $tag

########################################
# Launch tests

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

docker run \
  $interactive \
  --entrypoint="bash" \
  --env="ETHPROVIDER_URL=http://172.17.0.1:$ethprovider_port" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  --env="SUGAR_DADDY=$eth_mnemonic" \
  --name="${project}_$tag" \
  --rm \
  --volume="`pwd`:/root" \
  ${project}_builder -c 'cd modules/cf-core && npm run '"$cmd"' -- '"$@"
