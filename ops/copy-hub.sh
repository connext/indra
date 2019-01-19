#!/usr/bin/env bash
set -e

# this script will copy the hub into the camsite
# designed as a temporary workaround until spank deployment
# is configured with indra docker images to maintain
# ci/autobuilding pipeline

# optionally supply path to root of camsite repo
# otherwise, assume flat dir
if [ $# -eq 0 ]; then
  root="`cd ../ && pwd`"
else
  root="$1"
fi

# final destination of the copy files
src="$root/indra/modules/hub/src/"
dst="$root/camsite/hub/src/"

# set to only copy src folder
echo "$src"
echo "$dst"

rsync -avl --exclude "connext/*" --prune-empty-dirs "$src" "$dst"