#!/bin/bash
# This script should only be run from the project root of Indra
set -e

name="camsite"
repo="git@github.com:bohendo/$name.git"
branch="indra"
root="`pwd`"
path="$root/modules/hub"

if [[ ! -d "$path" ]]
then echo "Can't find $name, something ain't right, exiting" && exit
elif [[ -d "$path/.git" ]]
then echo "git history already imported, exiting" && exit
fi

mkdir -p /tmp/$name
cd /tmp/$name

if [[ -d "$name/.git" ]]
then rm -rf $name
fi

git clone $repo
cd $name
git checkout $branch
cp -r .git $path/.git
