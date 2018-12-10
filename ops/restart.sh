#!/bin/bash
set -e

project=connext
ops="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
flag=$1; [[ -n "$flag" ]] || flag=dev

make $flag

# If we're restarting the whole thing
if [[ "$flag" == "prod" || "$flag" == "dev" ]]
then
  if [[ "$flag" == "prod" ]]
  then make deploy
  fi
  bash $ops/stop.sh
  bash ops/deploy.$flag.sh

# If we're restarting one service of the stack
else
  docker service scale ${project}_$flag=0
  docker service scale ${project}_$flag=1
fi
