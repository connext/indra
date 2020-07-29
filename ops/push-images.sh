#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

# prod version: if we're on a tagged commit then use the tagged semvar, otherwise use the hash
if [[ -z "$1" ]]
then
  git_tag="`git tag --points-at HEAD | grep "indra-" | head -n 1`"
  if [[ -n "$git_tag" ]]
  then version="`echo $git_tag | sed 's/indra-//'`"
  else version="`git rev-parse HEAD | head -c 8`"
  fi
else version="$1"
fi

images="bot builder database ethprovider node proxy test_runner"

commit=`git rev-parse HEAD | head -c 8`
registry_url="https://index.docker.io/v1/repositories/${registry#*/}"

function safePush {
  image=$1
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
do safePush indra_$image
done
