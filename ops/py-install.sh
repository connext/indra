#!/bin/bash
set -e

if [[ ! -d .pyEnv ]]
then python3 -m virtualenv .pyEnv
fi

mkdir -p .cache/pip

user="`ls -dl .cache/pip | awk '{print $3}' | head -n 1`"

source .pyEnv/bin/activate

su $user -c "python3 -m pip install --cache .cache/pip -r docs/requirements.txt"
