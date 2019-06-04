#!/usr/bin/env bash
set -e

registry=docker.io/connextproject
project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"
version=$1
shift
images=$@

function safePush {
  image=$1
  if [[ "$version" == "latest" ]]
  then
    docker tag ${project}_$image:$version ${registry}/${project}_$image:$version
    docker push $registry/${project}_$image:$version
    return
  fi
  if curl -sflL "$registry/$image/tags/$version" > /dev/null
  then
    echo "Image $registry/$image:$version already exists on docker hub, let's not override it"
    return
  fi
  docker tag ${project}_$image:latest ${registry}/${project}_$image:$version
  docker push $registry/${project}_$image:$version
}

for image in $images
do safePush $image
done
