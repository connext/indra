#!/usr/bin/env bash
set -e

function makePrompt {
  prompt=$1

  read -p "$prompt (y/n) " -n 1 -r
  echo    # (optional) move to a new line
  if [[ ! $REPLY =~ ^[Yy]$ ]]
  then
      echo "Exiting."
      exit # handle exits from shell or function but don't exit interactive shell
  fi
}

MODE="${1:-staging}"
if [[ "$MODE" == "prod" ]]
then
  prod_server="daicard.io"
  branch="master"
elif [[ "$MODE" == "2020" ]]
then
  prod_server="2020.daicard.io"
  branch="money2020"
else
  rinkeby_hub="DAICARD_RINKEBY_HUB_URL=https://staging.hub.connext.network"
  prod_server="staging.connext.network"
  branch="`git symbolic-ref HEAD | sed -e 's|.*/\(.*\)|\1|'`"
fi

user=ubuntu
ssh_key="$HOME/.ssh/connext-aws"

if [[ ! -f "$ssh_key" ]]
then echo "To deploy to $prod_server, you need to have an ssh key at: $ssh_key" && exit
fi

echo "Deploying to server at: $prod_server"
echo "Before yolo deploying the card, let's go through a small checklist. Did you test all of the following flows:"

echo;
makePrompt "Have you run the e2e tests yet? Hint, try running: make start && make start-test (you'll need to run npm start in Indra first)"
echo && sleep 3 # Make sure people take a sec to read the above message

if [[ "$MODE" == "prod" ]]
then
  echo;
  makePrompt "You're about to deploy to production!? Have you deployed to staging yet?"
  makePrompt "After deploying to staging, have you manually tested the basic user flow (deposit, pay, withdraw)?"
  makePrompt "If these are big changes, did more than 1 person perform these manual tests?"
fi

makePrompt "Do you realize that the yolo deploy script may be deleted soon and the CI pipeline will be the only way to deploy?"
echo
makePrompt "Are you sure you want to deploy without any additional testing?"

echo;echo "Rebuilding a production-version of the app & pushing images to our container registry"
make prod
make push
if [[ "$?" != "0" ]]
then echo "Make sure you're logged into docker & have push permissions: docker login"
fi

# Make sure the prod server has the card repo available
echo "ssh -i $ssh_key $user@$prod_server \"bash -c 'git clone https://github.com/ConnextProject/card.git 2> /dev/null || true'\""
ssh -i $ssh_key $user@$prod_server "bash -c 'git clone https://github.com/ConnextProject/card.git 2> /dev/null || true'"

# Make sure the prod server's repo is up to date with the branch-of-interest
echo "ssh -i $ssh_key $user@$prod_server \"bash -c 'cd card && git fetch && git checkout --force $branch && git reset --hard origin/$branch'\""
ssh -i $ssh_key $user@$prod_server "bash -c 'cd card && git fetch && git checkout --force $branch && git reset --hard origin/$branch'"

echo;echo
echo "Preparing to re-deploy the card app to $prod_server. Without running any tests. Good luck."
echo;echo
sleep 2 # Give the user one last chance to ctrl-c before we pull the trigger

# Deploy!
echo "ssh -i $ssh_key $user@$prod_server \"bash -c 'cd card && DAICARD_DOMAINNAME=$prod_server DAICARD_MODE=staging $rinkeby_hub bash ops/restart.sh prod'\""
ssh -i $ssh_key $user@$prod_server "bash -c 'cd card && DAICARD_DOMAINNAME=$prod_server DAICARD_MODE=staging $rinkeby_hub bash ops/restart.sh prod'"
