#!/bin/bash
# This script should only be run from the project root of Indra
set -e

hub="`pwd`/modules/hub"

if [[ ! -d "$hub" ]]
then echo "Can't find the hub dir, something ain't right, exiting" && exit
elif [[ -d "$hub/.git" ]]
then echo "Camsite git history already imported, exiting" && exit
fi

mkdir -p /tmp/playground

cd /tmp/playground && echo "Current working directory: `pwd`"

if [[ ! -d "camsite/.git" ]]
then git clone git@github.com:ConnextProject/camsite.git
fi

cd camsite && echo "Current working directory: `pwd`"

git checkout indra
cp -r .git $hub/.git
