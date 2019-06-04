#!/usr/bin/env bash
set -e

MODE="${1:-staging}"
server="staging.hub.connext.network"
branch="`git symbolic-ref HEAD | sed -e 's|.*/\(.*\)|\1|'`"
user=ubuntu
ssh_key="$HOME/.ssh/connext-aws"

function makePrompt {
  prompt=$1
  read -p "$prompt (y/n) " -n 1 -r
  echo # (optional) move to a new line
  if [[ ! $REPLY =~ ^[Yy]$ ]]
  then echo "Aborting" && exit
  fi
}

if [[ ! -f "$ssh_key" ]]
then echo "To deploy to $server, you need to have an ssh key at: $ssh_key" && exit
fi

echo "Deploying to server at: $server"

echo;
makePrompt "Have you run the hub's unit tests? Try running: make test-hub"
echo && sleep 1 # Make sure people take a sec to read the above message
makePrompt "Have you run the e2e tests? Try running: make start && cd ../card && make test-prod"
echo && sleep 1 # Make sure people take a sec to read the above message

echo;echo "Rebuilding a production-version of the app & pushing images to our container registry"
make push
if [[ "$?" != "0" ]]
then echo "Make sure you're logged into docker & have push permissions: docker login"
fi

# Make sure the prod server has the card repo available
ssh -i $ssh_key $user@$server "bash -c 'git clone https://github.com/ConnextProject/indra.git 2> /dev/null || true'"

# Make sure the prod server's repo is up to date with the branch-of-interest
ssh -i $ssh_key $user@$server "bash -c 'cd indra && git fetch && git checkout --force $branch && git reset --hard origin/$branch'"

echo;echo
echo "Preparing to deploy the indra app to $server..."
echo;echo
sleep 3 # Give the user one last chance to ctrl-c before we pull the trigger

# Deploy!
ssh -i $ssh_key $user@$server "bash -c 'cd indra && INDRA_DOMAINNAME=$server INDRA_MODE=staging bash ops/restart.sh prod'"
