#!/bin/bash

set -e

project=connext
ops="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
flag=$1; [[ -n "$flag" ]] || flag=dev

if [[ "$flag" == "prod" || "$flag" == "dev" ]]
then
  bash "$ops/stop.sh"
  if [[ "$flag" == "prod" ]]
  then git pull && make deploy
  else make "$flag"
  fi
  bash "$ops/deploy.$flag.sh"

else
  docker service scale ${project}_$flag=0
  if [[ -z "`docker service ls | grep ${project}_ethprovider`" ]]
  then
    make prod
  else
    make dev
  fi
  docker service scale ${project}_$flag=1
fi
