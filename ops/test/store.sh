#!/usr/bin/env bash
set -e

args=$@

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

suffix="test_store"

postgres_db="${project}_$suffix"
postgres_host="${project}_database_$suffix"
postgres_password="$project_$suffix"
postgres_user="$project_$suffix"

network="${project}_$suffix"

# Kill the dependency containers when this script exits
function cleanup {
  echo;echo "Tests finished, stopping test containers.."
  docker container stop $postgres_host 2> /dev/null || true
}
trap cleanup EXIT

docker network create --attachable $network 2> /dev/null || true

# If file descriptors 0-2 exist, then we're prob running via interactive shell instead of on CD/CI
if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

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

echo "Starting ${project}_test_store"
docker run \
  --entrypoint="bash" \
  --env="INDRA_PG_DATABASE=$postgres_db" \
  --env="INDRA_PG_HOST=$postgres_host" \
  --env="INDRA_PG_PASSWORD=$postgres_password" \
  --env="INDRA_PG_PORT=5432" \
  --env="INDRA_PG_USERNAME=$postgres_user" \
  --env="LOG_LEVEL=$LOG_LEVEL" \
  $interactive \
  --name="${project}_test_store" \
  --network="$network" \
  --rm \
  --volume="$root:/root" \
  ${project}_builder -c "
    set -e
    echo 'Test-store container launched!'

    echo 'Waiting for \$INDRA_PG_HOST:\$INDRA_PG_PORT...'
    wait-for -t 60 \$INDRA_PG_HOST:\$INDRA_PG_PORT 2> /dev/null

    cd modules/store

    export PATH=./node_modules/.bin:\$PATH

    function finish {
      echo && echo 'Test-store container exiting..' && exit
    }
    trap finish SIGTERM SIGINT

    echo 'Launching store tests!';echo
    npm run test $args
  "
