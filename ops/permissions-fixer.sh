#!/bin/bash
set -e

user="$1"
cmd="$2"

# Fix ownership of output files
finish() {
    # Fix ownership of output files
    this_user="`id -u`:`id -g`"
    if [[ "$this_user" == "$user" ]]
    then echo "Same user, skipping permission fix"
    else echo "Fixing permissions for $user" && chown -R ${user} /root
    fi
}
trap finish EXIT

echo "Running command as user $user"
bash -c "$cmd"
