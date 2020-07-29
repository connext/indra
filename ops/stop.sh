#!/usr/bin/env bash

target=$1 # one of: indra, daicard, all
shift

function stop_stack {
  stack_name=$1
  docker stack rm $stack_name
  echo "Waiting for the $stack_name stack to shutdown.."
  while [[ -n "`docker container ls -q --filter label=com.docker.stack.namespace=$stack_name`" ]]
  do sleep 3 # wait until there are no more containers in this stack
  done
  while [[ -n "`docker network ls -q --filter label=com.docker.stack.namespace=$stack_name`" ]]
  do sleep 3 # wait until the stack's network has been removed
  done
  echo "Goodnight $stack_name!"
}

stack_name="`docker stack ls --format '{{.Name}}' | grep "$target"`"
if [[ -n "$stack_name" ]]
then
  stop_stack $stack_name
  exit
fi

container_ids="`docker container ls --filter 'status=running' --format '{{.ID}} {{.Names}}' |\
  cut -d "." -f 1 |\
  grep "$target" |\
  sort |\
  cut -d " " -f 1
`"

if [[ -n "$container_ids" ]]
then
  for container_id in $container_ids
  do
    echo "Stopping container $container_id"
    docker container stop $container_id > /dev/null
  done
else echo "No stack, service or running container names match: $target"
fi
