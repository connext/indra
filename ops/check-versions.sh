#!/usr/bin/env bash
set -e

echo "module: project root"
npm outdated -D | tail -n +2 | awk '$3 != $4'
echo

cd modules
for module in `ls`
do
  if [[ "$module" == "proxy" ]]
  then continue
  fi
  echo "module: $module"
  cd $module
  npm outdated -S | tail -n +2 | awk '$3 != $4'
  npm outdated -D | tail -n +2 | awk '$3 != $4'
  cd ..
  echo
done
