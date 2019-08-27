#!/usr/bin/env bash
set -e

project="indra"
organization="connextproject"

registry=docker.io/$organization
registry_url="https://index.docker.io/v1/repositories/$organization"
version="$1"
shift
images=$@

function safePush {
  image=${project}_$1
  echo;echo "Pushing $registry/$image:$version"
  if [[ "$version" == "latest" ]]
  then
    docker tag $image:$version ${registry}/$image:$version
    docker push $registry/$image:$version
  elif [[ -n "`curl -sflL "$registry_url/$image/tags/$version"`" ]]
  then
    echo "Image $registry/$image:$version already exists on docker hub, Aborting push"
    return
  else
    docker tag $image:latest ${registry}/$image:$version
    docker push $registry/$image:$version
  fi
}

for image in $images
do safePush $image
done
