#!/usr/bin/env bash
set -e

organization="connextproject"
project="indra"
registry_url="https://index.docker.io/v1/repositories/$organization"

commit=`shell git rev-parse HEAD | head -c 8`
release=`shell cat package.json | grep '"version":' | awk -F '"' '{print $$4}'`

version="$1" # one of "commit" or "release"
shift
images=$@

if [[ "$version" == "commit" ]]
then version=$commit
elif [[ "$version" == "release" ]]
then version=$release
else echo 'First arg should either be "commit" or "release" followed by images to push' && exit 1
fi

function safePush {
  image=${project}_$1
  echo;echo "Pushing $organization/$image:$version"
  if [[ -n "`curl -sflL "$registry_url/$image/tags/$version"`" ]]
  then
    echo "Image $organization/$image:$version already exists on docker hub, Aborting push"
    return
  else
    # latest -> commit -> release (we shouldn't ever use latest image to directly tag release)
    if [[ "$version" == "$commit" ]]
    then docker tag $image:latest $organization/$image:$version
    else docker tag $image:$commit $organization/$image:$version
    fi
    docker push $organization/$image:$version
    # latest images are used as cache for build steps, keep them up-to-date
    docker tag $organization/$image:$version $organization/$image:latest
    docker push $organization/$image:latest
  fi
}

for image in $images
do safePush $image
done
