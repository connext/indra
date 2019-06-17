#!/usr/bin/env bash
set -e

if [[ "`git symbolic-ref HEAD | sed -e 's|.*/\(.*\)|\1|'`" == "master" ]]
then echo "Don't push directly to master, use this instead: bash ops/deploy-indra.sh" && exit 1
fi
