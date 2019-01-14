#!/bin/bash
# This script should only be run from the project root of Indra
set -e

name="connext-client"
repo="git@github.com:bohendo/$name.git"
branch="indra-experimental"
root="`pwd`"
path="$root/modules/client"

if [[ ! -d "$path" ]]
then echo "Can't find $name, something ain't right, exiting" && exit
fi

if [[ -d "$path/.git" ]]
then echo "git history already imported, skipping that step"
else
  mkdir -p /tmp/$name
  cd /tmp/$name
  if [[ -d "$name/.git" ]]
  then rm -rf $name
  fi
  git clone $repo
  cd $name
  git checkout $branch
  cp -r .git $path/.git
fi
