#!/usr/bin/env bash
set -e

function get_outdated {
  format='{printf("| %-32s|%8s  ->  %-8s|\n", $1, $3, $4)}'
  npm outdated | tail -n +2 | awk '$3 != $4' | awk "$format"
  echo "-----"
  npm outdated -D | tail -n +2 | awk '$3 != $4' | awk "$format"
}

echo "==== Module: project root"
get_outdated
echo

cd modules
for module in `ls`
do
  if [[ "$module" == "proxy" ]]
  then continue
  fi
  echo "===== Module: $module"
  cd $module
  get_outdated
  cd ..
  echo
done
