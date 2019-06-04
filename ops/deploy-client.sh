#!/usr/bin/env bash
set -e

########################################
## Run some sanity checks to make sure we're really ready to deploy

if [[ -n "`git status -s`" ]]
then echo "Aborting: Make sure your git repo is clean" && exit 1
fi

if [[ "`pwd | sed 's|.*/\(.*\)|\1|'`" != "indra" ]]
then echo "Aborting: Make sure you're in the indra project root" && exit 1
fi

current_client_version="`npm view connext version`"

echo "What version of the connext client are we deploying? Current version: $current_client_version"
read -p "> " -r
echo
client_version="$REPLY" # get version from user input

if [[ -z "$client_version" || "$client_version" == "$current_client_version" ]]
then echo "Aborting: A new, unique client version is required" && exit 1
fi

echo "Verifying..."
if [[ -n "`npm view connext@$client_version`" ]]
then echo "Aborting: This version already exists on the npm registry" && exit 1
fi

echo "Confirm: we'll publish the current branch's client as connext@$client_version (y/n)?"
read -p "> " -r
echo
if [[ ! "$REPLY" =~ ^[Yy]$ ]]
then echo "Aborting by user request" && exit 1 # abort!
fi

echo "Let's go"

# edit modules/client/package.json to set new version number
cd modules/client
mv package.json .package.json
cat .package.json \
  | sed 's/"version": ".*"/"version": "'$client_version'"/' > package.json
rm .package.json

npm publish

# edit modules/hub/package.json to use the new version of the client
cd ../hub
mv package.json .package.json
cat .package.json \
  | sed 's/"connext": ".*"/"connext": "^'$client_version'"/' > package.json
rm .package.json

cd ../..
git add modules/client/package.json modules/hub/package.json
git commit -m "Publish client: connext@$client_version"
git tag client-$client_version
git push origin HEAD --no-verify
git push origin client-$client_version --no-verify
