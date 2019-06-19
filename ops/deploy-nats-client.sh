#!/usr/bin/env bash
set -e

package="`cat modules/nats-messaging-client/package.json | grep '"name":' | awk -F '"' '{print $4}'`"

########################################
## Run some sanity checks to make sure we're really ready to deploy

if [[ -n "`git status -s`" ]]
then echo "Aborting: Make sure your git repo is clean" && exit 1
fi

if [[ ! "`pwd | sed 's|.*/\(.*\)|\1|'`" =~ "indra" ]]
then echo "Aborting: Make sure you're in the indra project root" && exit 1
fi

current_version="`npm view $package version 2> /dev/null || echo "N/A"`"

echo "What version of $package are we deploying? Current version: $current_version"
read -p "> " -r
echo
target_version="$REPLY" # get version from user input

if [[ -z "$target_version" || "$target_version" == "$current_version" ]]
then echo "Aborting: A new, unique version is required" && exit 1
fi

echo "Verifying..."
if [[ -n "`npm view $package@$target_version 2> /dev/null || true`" ]]
then echo "Aborting: This version already exists on the npm registry" && exit 1
fi

echo "Confirm: we'll publish the current branch's package as $package@$target_version (y/n)?"
read -p "> " -r
echo
if [[ ! "$REPLY" =~ ^[Yy]$ ]]
then echo "Aborting by user request" && exit 1 # abort!
fi

echo "Let's go"

# edit this package's package.json to set new version number
cd modules/nats-messaging-client
mv package.json .package.json
cat .package.json \
  | sed 's/"version": ".*"/"version": "'$target_version'"/' > package.json
rm .package.json

npm publish --access=public

# edit dependencies to use the new version of this package
cd ../node
mv package.json .package.json
cat .package.json \
  | sed 's|"'"$package"'": ".*"|"'"$package"'": "^'$target_version'"|' > package.json
rm .package.json

cd ../client
mv package.json .package.json
cat .package.json \
  | sed 's|"'"$package"'": ".*"|"'"$package"'": "^'$target_version'"|' > package.json
rm .package.json

cd ../..
git add modules/nats-messaging-client modules/node
git commit -m "Publish package: $package@$target_version"
git tag nats-client-$target_version
git push origin HEAD --no-verify
git push origin nats-client-$target_version --no-verify
