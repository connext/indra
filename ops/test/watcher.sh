#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
suffix="watcher_tester"

##############
# Internal Config
# config & hard-coded stuff you might want to change

network="${project}_$suffix"

tester_host="${project}_$suffix"
ethprovider_host="${project}_ethprovider_$suffix"

ethprovider_port="8545"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
ethprovider_url="http://$ethprovider_host:$ethprovider_port"

# Kill the dependency containers when this script exits
function cleanup {
  echo "Removing $ethprovider_host & $tester_host containers"
  docker container stop "$ethprovider_host" 2> /dev/null || true
  docker container stop "$tester_host" 2> /dev/null || true
}
trap cleanup EXIT SIGINT SIGTERM
cleanup

docker network create --attachable $network 2> /dev/null || true

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

########################################
# Start dependencies

# TODO: the gasLimit shouldn't need to be 1000x higher than mainnet..

echo "Starting $ethprovider_host.."
docker run \
  --detach \
  --name="$ethprovider_host" \
  --network="$network" \
  --rm \
  --tmpfs="/data" \
  trufflesuite/ganache-cli:v6.9.1 \
    --db="/data" \
    --defaultBalanceEther="10000" \
    --gasLimit="9000000000" \
    --gasPrice="1000000000" \
    --host="0.0.0.0" \
    --mnemonic="$eth_mnemonic" \
    --networkId="1337" \
    --port="$ethprovider_port"

docker run \
  --entrypoint="bash" \
  --env="ETHPROVIDER_URL=$ethprovider_url" \
  --env="SUGAR_DADDY=$eth_mnemonic" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  $interactive \
  --name="$tester_host" \
  --network="$network" \
  --rm \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "Watcher tester container launched!"

    echo "Waiting for ethprovider to wake up.."
    wait-for ${ETHPROVIDER_URL#*://} &> /dev/null
    
    cd modules/watcher

    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "Watcher tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    echo "Launching tests!";echo
    npm run test
  '
