#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"

# make sure a network for this project has been created
docker swarm init 2> /dev/null || true
docker network create --attachable --driver overlay $project 2> /dev/null || true

agents="$1"
interval="$2"
limit="$3"
echo "Starting bot test with options: $agents agents | interval $interval | limit $limit"

if [[ -t 0 && -t 1 && -t 2 ]]
then interactive="--interactive --tty"
else echo "Running in non-interactive mode"
fi

########################################
## Launch bot

opts="$interactive \
  --env=INDRA_CHAIN_URL=http://172.17.0.1:8545 \
  --env=INDRA_NODE_URL=http://proxy:80 \
  --name=${project}_bot_tps \
  --network=$project \
  --rm"

args="--concurrency $agents \
  --interval $interval \
  --limit $limit \
  --log-level $LOG_LEVEL"

# prod version: if we're on a tagged commit then use the tagged semvar, otherwise use the hash
if [[ "$INDRA_ENV" == "prod" ]]
then
  git_tag="`git tag --points-at HEAD | grep "indra-" | head -n 1`"
  if [[ -n "$git_tag" ]]
  then version="`echo $git_tag | sed 's/indra-//'`"
  else version="`git rev-parse HEAD | head -c 8`"
  fi
  image=${project}_bot:$version
  echo "Executing image $image"
  exec docker run $opts $image tps $args

else
  echo "Executing image ${project}_builder"
  exec docker run \
    $opts \
    --entrypoint=bash \
    --volume="$root:/root" \
    ${project}_builder -c "cd modules/bot && node dist/cli.js tps $args"
fi
