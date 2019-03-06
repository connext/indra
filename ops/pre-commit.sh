#!/usr/bin/env bash

wegood="yes"
version="`git show :package.json | grep '"version":' | awk -F '"' '{print $4}'`"
registry="https://index.docker.io/v1/repositories/connextproject"

branch="`git symbolic-ref HEAD | sed -e 's|.*/\(.*\)|\1|'`"

if [[ "$branch" != "master" ]]
then echo "Skipping pre-commit hook for branch $branch" && exit
fi

echo "Pre-commit hook activated for $branch branch (staged package.json version: $version)"

echo
for image in database hub proxy
do
  if curl -sflL "$registry/indra_$image/tags/$version" > /dev/null
  then echo "connextproject/$image:$version already exists on docker hub" && wegood="no"
  else echo "connextproject/$image:$version does not exist on docker hub yet"
  fi
done
echo

if [[ "$wegood" == "no" ]]
then
  exec < /dev/tty
  echo "It's recommended you increment the version in package.json before commiting to master"
  read -p "Are you sure you want CI to override version $version docker images? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]
  then echo "Good choice" && exit 1
  else echo "Hope you know what you're doing";echo
  fi
fi

