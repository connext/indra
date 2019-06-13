#!/usr/bin/env bash
set -e

registry_url="https://index.docker.io/v1/repositories/connextproject"

########################################
## Run some sanity checks to make sure we're really ready to deploy

if [[ -n "`git status -s`" ]]
then echo "Aborting: Make sure your git repo is clean" && exit 1
fi

if [[ "`git symbolic-ref HEAD | sed 's|.*/\(.*\)|\1|'`" != "staging" ]]
then echo "Aborting: Make sure you've checked out the staging branch" && exit 1
fi

if [[ -n "`git diff origin/staging`" ]]
then echo "Aborting: Make sure your branch is up to date with origin/staging" && exit 1
fi

if [[ ! "`pwd | sed 's|.*/\(.*\)|\1|'`" =~ "indra" ]]
then echo "Aborting: Make sure you're in the indra project root" && exit 1
fi

########################################
## Gather info needed for deployment

current_indra_version="`git show master:package.json | grep '"version":' | awk -F '"' '{print $4}'`"

echo "What version of Indra are we deploying? Current version: $current_indra_version"
read -p "> " -r
echo
indra_version="$REPLY" # get version from user input

if [[ -z "$indra_version" || "$indra_version" == "$current_indra_version" ]]
then echo "Aborting: A new, unique indra version is required" && exit 1
fi

echo "Verifying..."
if [[ -n "`curl -sflL "$registry_url/indra_hub/tags/$indra_version"`" ]]
then echo "Aborting: This version already exists on docker hub" && exit 1
fi

echo "Confirm: we'll deploy the current staging branch as indra-$indra_version (y/n)?"
read -p "> " -r
echo
if [[ ! "$REPLY" =~ ^[Yy]$ ]]
then echo "Aborting by user request" && exit 1 # abort!
fi

echo "Let's go"

git checkout master
git merge --no-ff staging -m "Deploy indra-$indra_version"

# edit package.json to set new version number
mv package.json .package.json
cat .package.json | sed 's/"version": ".*"/"version": "'$indra_version'"/' > package.json
rm .package.json

# Push a new commit to master
git add package.json
git commit --amend --no-edit
git push origin master --no-verify

# Push a new indra release tag
git tag indra-$indra_version
git push origin indra-$indra_version --no-verify
