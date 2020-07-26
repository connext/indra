#!/usr/bin/env bash
set -e

stacks="indra daicard testnet"
target=$1 # one of: indra, daicard, all
shift

function stop_stack {
  stack_name="`docker stack ls --format '{{.Name}}' | grep "$1" | head -n 1`"
  if [[ -n "$stack_name" ]]
  then
    docker stack rm $stack_name
    echo "Waiting for the $stack_name stack to shutdown.."
    while [[ -n "`docker container ls -q --filter label=com.docker.stack.namespace=$stack_name`" ]]
    do sleep 3 # wait until there are no more containers in this stack
    done
    while [[ -n "`docker network ls -q --filter label=com.docker.stack.namespace=$stack_name`" ]]
    do sleep 3 # wait until the stack's network has been removed
    done
    echo "Goodnight $stack_name!"
  fi
}

for stack in $stacks
do
  if [[ "$target" == "$stack" || "$target" == "all" ]]
  then stop_stack $stack
  fi
done

if [[ "$target" == "all" ]]
then
  for stack in $stacks
  do docker container ls -f name=${stack}_* -q | xargs docker container stop 2> /dev/null || true
  done
fi
