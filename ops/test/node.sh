#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

tag="node_tester"
cmd="${1:-test}"
shift || true # $1 is the command to npm run. Extra options, if any, come after

source $root/dev.env

# Make sure keys have proper newlines inserted (bc GitHub Actions strips newlines from secrets)
export INDRA_NATS_JWT_SIGNER_PRIVATE_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PRIVATE_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN RSA PRIVATE KEY-----/\\\n-----BEGIN RSA PRIVATE KEY-----\\\n/' |\
  sed 's/-----END RSA PRIVATE KEY-----/\\\n-----END RSA PRIVATE KEY-----\\\n/'`

export INDRA_NATS_JWT_SIGNER_PUBLIC_KEY=`
  echo $INDRA_NATS_JWT_SIGNER_PUBLIC_KEY | tr -d '\n\r' |\
  sed 's/-----BEGIN PUBLIC KEY-----/\\\n-----BEGIN PUBLIC KEY-----\\\n/' | \
  sed 's/-----END PUBLIC KEY-----/\\\n-----END PUBLIC KEY-----\\\n/'`

mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

####################
# Internal Config
# config & hard-coded stuff you might want to change

chain_id_1=1339
chain_id_2=1340
chain_host_1="testnet_$chain_id_1"
chain_host_2="testnet_$chain_id_2"

nats_host="${project}_nats_$tag"
network="${project}"
node_host="${project}_$tag"
node_port="8080"
postgres_db="${project}"
postgres_host="${project}_database_$tag"
postgres_password="$project"
postgres_port="5432"
postgres_user="$project"
redis_host="${project}_redis_$tag"

docker network create --attachable $network 2> /dev/null || true

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

########################################
# Start dependencies

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $postgres_host 2> /dev/null || true
  docker container stop $nats_host 2> /dev/null || true
  docker container stop $redis_host 2> /dev/null || true
  docker container stop $node_host 2> /dev/null || true
}
trap cleanup EXIT

echo "Node tester activated!";echo;

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
  provide/nats-server:indra -D -V

echo "Starting $redis_host.."
docker run \
  --detach \
  --name="$redis_host" \
  --network="$network" \
  --rm \
  redis:5-alpine

bash ops/start-testnet.sh $chain_id_1 $chain_id_2
chain_providers="`cat $root/.chaindata/providers/${chain_id_1}-${chain_id_2}.json`"
contract_addresses="`cat $root/.chaindata/addresses/${chain_id_1}-${chain_id_2}.json`"

########################################
# Run Tests

echo "Starting $node_host.."
docker run \
  $interactive \
  --entrypoint="bash" \
  --env="CLIENT_LOG_LEVEL=${CLIENT_LOG_LEVEL:-${LOG_LEVEL:-0}}" \
  --env="INDRA_ADMIN_TOKEN=$INDRA_ADMIN_TOKEN" \
  --env="INDRA_CHAIN_PROVIDERS=$chain_providers" \
  --env="INDRA_CONTRACT_ADDRESSES=$contract_addresses" \
  --env="INDRA_DEFAULT_CHAIN=$chain_id_1" \
  --env="INDRA_LOG_LEVEL=${INDRA_LOG_LEVEL:-${LOG_LEVEL:-0}}" \
  --env="INDRA_MNEMONIC=$mnemonic" \
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
  --name="$node_host" \
  --network="$network" \
  --rm \
  --volume="$root:/root" \
  ${project}_builder -c "bash modules/node/ops/test.sh $cmd"
