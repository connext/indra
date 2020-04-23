#!/bin/bash
set -e

secret_name="${1:-indra_mnemonic}";

if [[ -n "`docker secret ls | grep "$secret_name"`" ]]
then echo "A secret called $secret_name already exists, skipping secret setup"
else

  # Prepare to load the node's private key into the server's secret store
  echo "Copy the $secret_name secret to your clipboard then paste it below & hit enter (no echo)"
  echo -n "> "
  read -s mnemonic
  echo

  if [[ -z "$mnemonic" ]]
  then echo "No mnemonic provided, skipping secret creation" && exit 0;
  fi

  id="`echo $mnemonic | tr -d '\n\r' | docker secret create $secret_name -`"
  if [[ "$?" == "0" ]]
  then
    echo "Successfully loaded mnemonic into secret store"
    echo "name=$secret_name id=$id"
    echo
  else echo "Something went wrong creating secret called $secret_name"
  fi
fi
