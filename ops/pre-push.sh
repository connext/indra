#!/usr/bin/env bash
set -e

# Thanks to https://stackoverflow.com/a/5180310 for getting staged changes
version="`git show :package.json | grep '"version":' | awk -F '"' '{print $4}'`"
registry="https://index.docker.io/v1/repositories/connextproject"
wegood="yes"
branch="`git symbolic-ref HEAD | sed -e 's|.*/\(.*\)|\1|'`"

if [[ "$branch" != "master" ]]
then echo "Skipping pre-push hook for branch $branch" && exit
fi

echo "Pre-push hook activated for $branch branch (staged package.json version: $version)"

echo
for image in database hub proxy
do
  # Thanks to https://stackoverflow.com/a/39731444 for url to query
  if curl -sflL "$registry/indra_$image/tags/$version" > /dev/null
  then echo "connextproject/$image:$version already exists on docker hub" && wegood="no"
  else echo "connextproject/$image:$version does not exist on docker hub yet"
  fi
done
echo

if [[ "$wegood" == "no" ]]
then
  exec < /dev/tty # Thanks to https://stackoverflow.com/a/10015707
  echo "It's recommended you increment the version in package.json before pushing to master"
  read -p "Are you sure you want CI to override version $version docker images? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]
  then echo "Good choice" && exit 1 # abort!
  else echo "Hope you know what you're doing";echo
  fi
fi

# Tag this commit (or move the old tag to this commit)
version="`git show :package.json | grep '"version":' | awk -F '"' '{print $4}'`"
git tag -f v$version
