#!/bin/bash
set -e

this_user="`id -u`:`id -g`"
user="$1"
cmd="$2"

# Fix ownership of output files
finish() {
    # Fix ownership of output files
    if [[ "$this_user" == "$user" ]]
    then echo "Same user, skipping permission fix"
    else
      echo "Fixing permissions for $user"
      chown -R ${user} /root
      if [[ -d /client ]]
      then chown -R ${user} /client
      fi
    fi
}
trap finish EXIT

echo "Running command as "$this_user" (target user: $user)"
bash -c "$cmd"
