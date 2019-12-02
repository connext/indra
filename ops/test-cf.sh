#!/usr/bin/env bash
set -e

project="indra"

test_command='
  jest --setupFiles dotenv-extended/config --runInBand --forceExit '"'$@'"'
'

watch_command='
  CI=true exec jest --color --setupFiles dotenv-extended/config --runInBand --watch '"$@"'
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

########################################
# Start dependencies

echo "Starting $ethprovider_host.."
docker run \
  --detach \
  --name="$ethprovider_host" \
  --network="$network" \
  --rm \
  --tmpfs="/data" \
  trufflesuite/ganache-cli:v6.4.3 \
    --db="/data" \
    --host="0.0.0.0" \
    --mnemonic="$eth_mnemonic" \
    --networkId="4447" \
    --port="$ethprovider_port"

########################################
# Run Tests

docker run \
  --entrypoint="bash" \
  --env="ETHPROVIDER_URL=$ethprovider_url" \
  --env="SUGAR_DADDY=$eth_mnemonic" \
  --interactive \
  --name="${project}_test_cf_core" \
  --network="$network" \
  --rm \
  --tty \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    set -e
    echo "CF tester container launched!";echo
    cd modules/cf-core
    rm -rf .env
    env > .env
    export PATH=./node_modules/.bin:$PATH
    function finish {
      echo && echo "CF tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT
    '"$command"'
  '
