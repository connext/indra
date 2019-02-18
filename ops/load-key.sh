#!/bin/bash

key_name=private_key

if [[ -n "`docker secret ls | grep " $key_name"`" ]]
then echo "A secret called $key_name already exists, aborting"
     echo "Remove existing secret with: docker secret rm $key_name"
     exit 1
fi

# Prepare to set or use our user's password
echo "Copy your private key to your clipboard"
echo "Paste it below & hit enter"
echo -n "> "
read -s key
echo

id="`echo $key | docker secret create $key_name -`"
if [[ "$?" == "0" ]]
then echo "Successfully loaded private key into secret store"
     echo "name=$key_name id=$id"
else echo "Something went wrong creating secret called $key_name"
fi
