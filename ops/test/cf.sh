#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

test_command='
  jest --setupFiles dotenv-extended/config --runInBand --forceExit --passWithNoTests '"'$@'"'
'

watch_command='
  CI=true exec jest --color --setupFiles dotenv-extended/config --runInBand --passWithNoTests --watch '"$@"'
'

if [[ "$1" == "--watch" ]]
then
  suffix="cf_watcher"
  command="$watch_command"
  shift # forget $1 and replace it w $2, etc
else
  suffix="cf_tester"
  command="$test_command"
fi

####################
# Internal Config
# config & hard-coded stuff you might want to change

network="${project}_$suffix"

ethprovider_host="${project}_ethprovider_$suffix"
ethprovider_port="8545"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
ethprovider_url="http://$ethprovider_host:$ethprovider_port"

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $ethprovider_host 2> /dev/null || true
}
trap cleanup EXIT

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

########################################
# Run Tests

docker run \
  --entrypoint="bash" \
  --env="ETHPROVIDER_URL=$ethprovider_url" \
  --env="SUGAR_DADDY=$eth_mnemonic" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  $interactive \
  --name="${project}_test_cf_core" \
  --network="$network" \
  --rm \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "CF tester container launched!"
    echo "Waiting for ethprovider to wake up.."
    wait-for ${ETHPROVIDER_URL#*://} &> /dev/null
    cd modules/cf-core
    export PATH=./node_modules/.bin:$PATH
    function finish {
      echo && echo "CF tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT
    echo "Launching tests!";echo
    '"$command"'
  '
