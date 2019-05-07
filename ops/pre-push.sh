#!/usr/bin/env bash
set -e

# Thanks to https://stackoverflow.com/a/5180310 for getting staged changes
branch="`git symbolic-ref HEAD | sed -e 's|.*/\(.*\)|\1|'`"
version="`git show :package.json | grep '"version":' | awk -F '"' '{print $4}'`"
registry="https://index.docker.io/v1/repositories/connextproject"
image="indra_hub"

if [[ "$branch" != "master" ]]
then echo "Skipping pre-push hook for branch $branch" && exit
else echo "Pre-push hook activated for $branch branch (package.json version: $version)"
fi

# Thanks to https://stackoverflow.com/a/39731444 for url to query
echo "Checking image tags on docker hub..."
if curl -sflL "$registry/$image/tags/$version" > /dev/null
then
  echo "connextproject/$image:$version already exists on docker hub" && wegood="no"
  exec < /dev/tty # Thanks to https://stackoverflow.com/a/10015707
  echo "It's recommended you increment the version in package.json before pushing to master"
  read -p "Are you sure you want CI to replace version $version docker images? (y/n) " -n 1 -r
  echo
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]
  then echo "Good choice" && exit 1 # abort!
  fi
  echo "Hope you know what you're doing";echo
  read -p "Do you want to override the old version tag? (y/n) " -n 1 -r
  echo
  if [[ "$REPLY" =~ ^[Yy]$ ]]
  then
    git tag -f indra-$version
    echo "You should override the remote tag too: git push origin indra-$version --no-verify --force";echo
  fi
else
  echo "connextproject/$image:$version does not exist on docker hub yet"
  git tag indra-$version
  echo "You should share this tag: git push origin indra-$version --no-verify";echo
fi
