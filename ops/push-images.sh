#!/usr/bin/env bash
set -e

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $dir/../package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

version="$1"

commit=`git rev-parse HEAD | head -c 8`
images="database ethprovider node proxy relay test_runner"
registry_url="https://index.docker.io/v1/repositories/${registry#*/}"

function safePush {
  image=${project}_$1
  echo;echo "Pushing $registry/$image:$version"
  if [[ -n "`curl -sflL "$registry_url/$image/tags/$version"`" ]]
  then
    echo "Image $registry/$image:$version already exists on docker hub, Aborting push"
    return
  else
    docker tag $image:$commit $registry/$image:$version
    docker push $registry/$image:$version
    # latest images are used as cache for build steps, keep them up-to-date
    docker tag $image:$commit $registry/$image:latest
    docker push $registry/$image:latest
  fi
}

for image in $images
do safePush $image
done
