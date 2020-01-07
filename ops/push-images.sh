#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | jq .name | tr -d '"'`"
organization="connextproject"
registry_url="https://index.docker.io/v1/repositories/$organization"
commit=`git rev-parse HEAD | head -c 8`

version="$1"
images="bot database ethprovider node proxy relay test_runner"

function safePush {
  image=${project}_$1
  echo;echo "Pushing $organization/$image:$version"
  if [[ -n "`curl -sflL "$registry_url/$image/tags/$version"`" ]]
  then
    echo "Image $organization/$image:$version already exists on docker hub, Aborting push"
    return
  else
    docker tag $image:$commit $organization/$image:$version
    docker push $organization/$image:$version
    # latest images are used as cache for build steps, keep them up-to-date
    docker tag $image:$commit $organization/$image:latest
    docker push $organization/$image:latest
  fi
}

for image in $images
do safePush $image
done
