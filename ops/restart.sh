#!/bin/bash
set -e

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}'`"
ops="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
flag=$1; [[ -n "$flag" ]] || flag=dev

# If we're restarting the whole thing
if [[ "$flag" == "prod" || "$flag" == "dev" ]]
then
  bash $ops/stop.sh
  bash ops/deploy.$flag.sh

# If we're restarting one service of the stack
else
  docker service scale ${project}_$flag=0
  docker service scale ${project}_proxy=0
  docker service scale ${project}_proxy=1
  docker service scale ${project}_$flag=1
fi
