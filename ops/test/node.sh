#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

if [[ "$1" == "--watch" ]]
then
  suffix="node_watcher"
  command='exec ts-mocha --bail --check-leaks --watch --timeout 45000 src/**/*.spec.ts '"$@"
  shift # forget $1 and replace it w $2, etc
else
  suffix="node_tester"
  command='ts-mocha --bail --check-leaks --exit --timeout 45000 src/**/*.spec.ts '"$@"
fi
echo $command

function extractEnv {
  grep "$1" "$2" | cut -d "=" -f 2- | tr -d '\n\r"' | sed 's/ *#.*//'
}

# First choice: use existing env vars (dotEnv not called)
function dotEnv {
  key="$1"
  if [[ -f .env && -n "`extractEnv $key .env`" ]] # Second choice: load from custom secret env
  then extractEnv $key .env
  elif [[ -f dev.env && -n "`extractEnv $key dev.env`" ]] # Third choice: load from public defaults
  then extractEnv $key dev.env
  fi
}

INDRA_NATS_JWT_SIGNER_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----MIIEowIBAAKCAQEAqU/GXp8MqmugQyRk5FUFBvlJt1/h7L3Crzlzejz/OxriZdq/lBNQW9S1kzGc7qjXprZ1Kg3zP6irr6wmvP0WYBGltWs2cWUAmxh0PSxuKdT/OyL9w+rjKLh4yo3ex6DX3Ij0iP01Ej2POe5WrPDS8j6LT0s4HZ1FprL5h7RUQWV3cO4pF+1kl6HlBpNzEQzocW9ig4DNdSeUENARHWoCixE1gFYo9RXm7acqgqCk3ihdJRIbO4e/m1aZq2mvAFK+yHTIWBL0p5PF0Fe8zcWdNeEATYB+eRdNJ3jjS8447YrcbQcBQmhFjk8hbCnc3Rv3HvAapk8xDFhImdVF1ffDFwIDAQABAoIBAGZIs2ZmX5h0/JSTYAAw/KCB6W7Glg4XdY21/3VRdD+Ytj0iMaqbIGjZz/fkeRIVHnKwt4d4dgN3OoEeVyjFHMdc4eb/phxLEFqiI1bxiHvtGWP4d6XsON9Y0mBL5NJk8QNiGZjIn08tsWEmA2bm9gkyj6aPoo8BfBqA9Q5uepgmYIPT2NtEXvTbd2dedAEJDJspHKHqBfcuNBVoVhUixVSgehWGGP4GX+FvAEHbawDrwULkMvgblH+X8nBtzikp29LNpOZSRRbqF/Da0AkluFvuDUUIzitjZs5koSEAteaulkZO08BMxtovQjh/ZPtVZKZ27POCNOgRsbm/lVIXRMECgYEA2TQQ2Xy6eO5XfbiT4ZD1Z1xe9B6Ti7J2fC0ZNNSXs4DzdYVcHNIuZqfK6fGqmByvSnFut7n5Po0z2FdXc7xcKFJdBZdFP3GLXbN9vpRPIk9b6n+0df471uTYwVocmAGXez++y73j5XzHQQW4WmmC5SlKjQUWCGkuzISVjRDtlZ0CgYEAx43KPrJxSijjE2+VWYjNFVuv6KilnWoA8I2cZ7TtPi4h//r5vyOUst0egR3lJ7rBof74VttQPvqAk3GN697IrE/bSwefwG2lM1Ta0KB3jn6b/iT4ckmaOB+v6aDHq/GPW6l/sxD0RIEelRYZlsNLepRgKhcQckhjnWzQuGWSl0MCgYBYJQ0BdeCm2vKejp1U2OL+Qzo1j4MJGi+DTToBepTlv9sNQkWTXKh/+HAcaHp2qI1qhIYOAWbov5zemvNegH5Vzrb5Yd40VPvd1s2c3csPfW0ryQ+PItFd8BkWvl8EQQEcf04KmNE3fF/QP2YFKvR30z3x5LKAT08yqEuYp9oC8QKBgQCfc9XqGU3bEya3Lg8ptt0gtt2ty6xiRwSvMoiKeZCkgdpbH6EWMQktjvBD/a5Q+7KjjgfD54SMfj/lEPR1R9QTk8/HeTUWXsaFaMVbtQ0zSEm/Xq1DLTrUo8U9qmJCK0gA10SZwe9dGctlF36k8DJMpWjd2QYkO2GVthBld4wV3wKBgC7S4q0wmcrQIjyDIFmISQNdOAJhR0pJXG8mK2jECbEXxbKkAJnLj73DJ+1OVBlx4HXx54PiEkV3M3iTinf5tBSi8nA2D3s829F65XKFli1RC4rJv+2ygH8PnXX9rQKhK/v6/jeelKquH8zy894hLZe7feSsWV9GMgb5l9p+UzWB-----END RSA PRIVATE KEY-----"
INDRA_NATS_JWT_SIGNER_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqU/GXp8MqmugQyRk5FUFBvlJt1/h7L3Crzlzejz/OxriZdq/lBNQW9S1kzGc7qjXprZ1Kg3zP6irr6wmvP0WYBGltWs2cWUAmxh0PSxuKdT/OyL9w+rjKLh4yo3ex6DX3Ij0iP01Ej2POe5WrPDS8j6LT0s4HZ1FprL5h7RUQWV3cO4pF+1kl6HlBpNzEQzocW9ig4DNdSeUENARHWoCixE1gFYo9RXm7acqgqCk3ihdJRIbO4e/m1aZq2mvAFK+yHTIWBL0p5PF0Fe8zcWdNeEATYB+eRdNJ3jjS8447YrcbQcBQmhFjk8hbCnc3Rv3HvAapk8xDFhImdVF1ffDFwIDAQAB-----END PUBLIC KEY-----"


# Make sure keys have proper newlines inserted
# (bc GitHub Actions strips newlines from secrets)
export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PRIVATE_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN RSA PRIVATE KEY-----/\\\n-----BEGIN RSA PRIVATE KEY-----\\\n/' |\
  sed 's/-----END RSA PRIVATE KEY-----/\\\n-----END RSA PRIVATE KEY-----\\\n/'`

export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PUBLIC_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN PUBLIC KEY-----/\\\n-----BEGIN PUBLIC KEY-----\\\n/' | \
  sed 's/-----END PUBLIC KEY-----/\\\n-----END PUBLIC KEY-----\\\n/'`

####################
# Internal Config
# config & hard-coded stuff you might want to change
admin_token="cxt1234"

network="${project}_$suffix"

eth_network="ganache"
ganacheId="1337"

ethprovider_host="${project}_ethprovider_$suffix"
eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
if [[ -f address-book.json ]]
then eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
else eth_contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
fi
eth_rpc_url="http://$ethprovider_host:8545"

# get supported addresses
token_address="`echo $eth_contract_addresses | jq '.["'"$ganacheId"'"].Token.address' | tr -d '"'`"
allowed_swaps='[{"from":"'"$token_address"'","to":"0x0000000000000000000000000000000000000000","priceOracleType":"UNISWAP"},{"from":"0x0000000000000000000000000000000000000000","to":"'"$token_address"'","priceOracleType":"UNISWAP"}]'

postgres_db="${project}_$suffix"
postgres_host="${project}_database_$suffix"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"

nats_host="${project}_nats_$suffix"

redis_host="${project}_redis_$suffix"

node_port="8080"
node_host="${project}_$suffix"

make deployed-contracts

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $ethprovider_host 2> /dev/null || true
  docker container stop $postgres_host 2> /dev/null || true
  docker container stop $nats_host 2> /dev/null || true
  docker container stop $redis_host 2> /dev/null || true
  docker container stop $node_host 2> /dev/null || true
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
cwd="`pwd`"

echo "Node tester activated!";echo;

echo "Starting $ethprovider_host.."
docker run \
  --detach \
  --env="ETH_MENMONIC=$eth_mnemonic" \
  --name="$ethprovider_host" \
  --network="$network" \
  --rm \
  --mount="type=bind,source=$cwd,target=/root" \
  --mount="type=volume,source=${project}_chain_dev,target=/data" \
  ${project}_builder -c "cd modules/contracts && bash ops/entry.sh start"

echo "Starting $postgres_host.."
docker run \
  --detach \
  --env="POSTGRES_DB=$postgres_db" \
  --env="POSTGRES_PASSWORD=$postgres_password" \
  --env="POSTGRES_USER=$postgres_user" \
  --name="$postgres_host" \
  --network="$network" \
  --rm \
  --tmpfs="/var/lib/postgresql/data" \
  postgres:9-alpine

echo "Starting $nats_host.."
docker run \
  --env="JWT_SIGNER_PUBLIC_KEY=$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY" \
  --detach \
  --name="$nats_host" \
  --network="$network" \
  --rm \
  provide/nats-server:latest

echo "Starting $redis_host.."
docker run \
  --detach \
  --name="$redis_host" \
  --network="$network" \
  --rm \
  redis:5-alpine

########################################
# Run Tests

echo "Starting $node_host.."
docker run \
  --entrypoint="bash" \
  --env="INDRA_ADMIN_TOKEN=$admin_token" \
  --env="INDRA_ALLOWED_SWAPS=$allowed_swaps" \
  --env="INDRA_ETH_CONTRACT_ADDRESSES=$eth_contract_addresses" \
  --env="INDRA_ETH_MNEMONIC=$eth_mnemonic" \
  --env="INDRA_ETH_RPC_URL=$eth_rpc_url" \
  --env="INDRA_LOG_LEVEL=${INDRA_LOG_LEVEL:-0}" \
  --env="LOG_LEVEL=${LOG_LEVEL:-0}" \
  --env="INDRA_NATS_CLUSTER_ID=" \
  --env="INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=$INDRA_NATS_JWT_SIGNER_PRIVATE_KEY" \
  --env="INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=$INDRA_NATS_JWT_SIGNER_PUBLIC_KEY" \
  --env="INDRA_NATS_SERVERS=nats://$nats_host:4222" \
  --env="INDRA_NATS_WS_ENDPOINT=wss://$nats_host:4221" \
  --env="INDRA_PG_DATABASE=$postgres_db" \
  --env="INDRA_PG_HOST=$postgres_host" \
  --env="INDRA_PG_PASSWORD=$postgres_password" \
  --env="INDRA_PG_PORT=$postgres_port" \
  --env="INDRA_PG_USERNAME=$postgres_user" \
  --env="INDRA_PORT=$node_port" \
  --env="INDRA_REDIS_URL=redis://$redis_host:6379" \
  --env="NODE_ENV=development" \
  $interactive \
  --name="$node_host" \
  --network="$network" \
  --rm \
  --volume="`pwd`:/root" \
  ${project}_builder -c '
    echo "Node Tester Container launched!";echo
    shopt -s globstar

    echo "Waiting for ${INDRA_ETH_RPC_URL#*://}..."
    wait-for -t 60 ${INDRA_ETH_RPC_URL#*://} 2> /dev/null
    echo "Waiting for $INDRA_PG_HOST:$INDRA_PG_PORT..."
    wait-for -t 60 $INDRA_PG_HOST:$INDRA_PG_PORT 2> /dev/null
    echo "Waiting for ${INDRA_NATS_SERVERS#*://}..."
    wait-for -t 60 ${INDRA_NATS_SERVERS#*://} 2> /dev/null
    echo "Waiting for ${INDRA_REDIS_URL#*://}..."
    wait-for -t 60 ${INDRA_REDIS_URL#*://} 2> /dev/null
    echo

    cd modules/node
    export PATH=./node_modules/.bin:$PATH

    function finish {
      echo && echo "Node tester container exiting.." && exit
    }
    trap finish SIGTERM SIGINT

    '"$command"'
  '
