#!/usr/bin/env bash
set -e

cwd="`pwd`"

for package in `ls modules`
do
  echo "Linting ${package}"
  cd "${cwd}/modules/${package}"
  npm run lint
  cd "${cwd}"
done
