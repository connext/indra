#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"
tmp="$root/.tmp"; mkdir -p $tmp

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# make sure a network for this project has been created
docker network create --attachable --driver overlay $project 2> /dev/null || true

if [[ -n "`docker container ls --format '{{.Names}}' | grep ${project}_daicard`" ]]
then echo "Daicard is already running" && exit
fi

####################
# Webserver config

public_port=3001

# prod version: if we're on a tagged commit then use the tagged semvar, otherwise use the hash
if [[ "$INDRA_ENV" == "prod" ]]
then
  git_tag="`git tag --points-at HEAD | grep "indra-" | head -n 1`"
  if [[ -n "$git_tag" ]]
  then version="`echo $git_tag | sed 's/indra-//'`"
  else version="`git rev-parse HEAD | head -c 8`"
  fi
  image="${project}_daicard:$version"

else
  image="${project}_builder"
  opts="--entrypoint bash --mount type=bind,source=$root,target=/root"
  flag="-c"
  arg="cd modules/daicard && npm run start"
fi

####################
# Launch Daicard container

echo "Starting daicard image ${image} w arg '$arg'"

docker run $opts \
  --detach \
  --name "${project}_daicard" \
  --network "$project" \
  --publish "$public_port:3000" \
  --rm \
  $image $flag "$arg"

docker container logs --follow ${project}_daicard &
pid=$!

echo "Daicard has been started, waiting for it to start responding.."
timeout=$(expr `date +%s` + 180)
while true
do
  res="`curl -k -m 5 -s http://localhost:$public_port || true`"
  if [[ -z "$res" || "$res" == "Waiting for daicard to wake up" ]]
  then
    if [[ "`date +%s`" -gt "$timeout" ]]
    then echo "Timed out waiting for daicard to respond.." && break
    else sleep 2
    fi
  else echo "Good Morning!" && break;
  fi
done
kill $pid
