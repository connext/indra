#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"

for package in `ls modules`
do
  echo "Linting ${package}"
  cd "${root}/modules/${package}"
  npm run lint
  cd "${root}"
done
