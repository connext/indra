#!/usr/bin/env bash
set -e

cwd="`pwd`"

packages="cf-core,channel-provider,client,contracts,daicard,dashboard,messaging,node,payment-bot,store,test-runner,types"

for package in `echo $packages | tr ',' ' '`
do
  echo "Linting ${package}"
  cd "${cwd}/modules/${package}"
  npm run lint
  cd "${cwd}"
done
