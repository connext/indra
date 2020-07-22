#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

version="$1"
images="database ethprovider node proxy test_runner webserver"

for image in $images
do
  echo "Pulling image: $registry/${project}_$image:$version"
  docker pull $registry/${project}_$image:$version || true
  docker tag $registry/${project}_$image:$version ${project}_$image:$version || true
done
