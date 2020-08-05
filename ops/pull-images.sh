#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="`cat $root/package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

images="bot builder database ethprovider node proxy test_runner"

commit="`git rev-parse HEAD | head -c 8`"
git_tag="`git tag --points-at HEAD | grep "indra-" | head -n 1`"

# Try to get the semver from git tag or commit message
if [[ -z "$git_tag" ]]
then
  message="`git log --format=%B -n 1 HEAD`"
  if [[ "$message" == "Deploy indra-"* ]]
  then semver="${message#Deploy idnra-}"
  else semver=""
  fi
else semver="`echo $git_tag | sed 's/indra-//'`"
fi

for image in $images
do
  for version in latest $commit $semver
  do
    echo "Pulling image: $registry/${project}_$image:$version"
    docker pull $registry/${project}_$image:$version || true
    docker tag $registry/${project}_$image:$version ${project}_$image:$version || true
  done
done
