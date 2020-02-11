#!/usr/bin/env bash
set -e

format='{printf("| %-32s|%8s  ->  %-8s|\n", $1, $3, $4)}'

echo "==== Module: project root"
npm outdated -D | tail -n +2 | awk '$3 != $4' | awk "$format"
echo

cd modules
for module in `ls`
do
  if [[ "$module" == "proxy" ]]
  then continue
  fi
  echo "===== Module: $module"
  cd $module
  npm outdated | tail -n +2 | awk '$3 != $4' | awk "$format"
  echo "-----"
  npm outdated -D | tail -n +2 | awk '$3 != $4' | awk "$format"
  cd ..
  echo
done
