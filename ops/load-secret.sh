#!/bin/bash
set -e

function load_secret {
  name=$1

  # Sanity check: does this secret already exist?
  if [[ -n "`docker secret ls | grep " $name"`" ]]
  then echo "A secret called $name already exists, aborting"
       echo "Remove existing secret to reset: docker secret rm $name"
       exit
  fi

  echo "Copy your $name secret to your clipboard"
  echo "Paste it below & hit enter (no echo)"
  echo -n "> "
  read -s secret
  echo

  id="`echo $secret | tr -d ' \n\r' | docker secret create $name -`"
  if [[ "$?" == "0" ]]
  then echo "Successfully loaded secret into secret store"
       echo "name=$name id=$id"
  else echo "Something went wrong creating secret called $name"
  fi
}

if [[ -n "$1" ]]
then load_secret $1
else load_secret private_key
fi

