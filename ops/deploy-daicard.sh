#!/usr/bin/env bash
set -e

daicard="$1"
indra="https://${2#*://}"
ssh_key="$HOME/.ssh/connext-aws"
user=ubuntu
registry="docker.io/connextproject"

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

if [[ -z "$daicard" ]]
then echo "Please provide hostname of daicard server to deploy to as first argument." && exit
fi

if [[ -z "$indra" ]]
then echo "Please provide hostname of upstream indra server to deploy as second argument." && exit
fi


if [[ ! -f "$ssh_key" ]]
then echo "To deploy, you need to have an ssh key at: $ssh_key" && exit
fi

echo "Deploying a proxy to: $daicard"
echo "Requests will be forwarded to: $indra"

echo;echo "Building & pushing latest version of the daicard proxy"
make daicard-proxy
docker tag daicard_proxy $registry/daicard_proxy
docker push $registry/daicard_proxy
if [[ "$?" != "0" ]]
then echo "Make sure you're logged into docker & have push permissions: docker login" && exit
fi

echo;echo "Copying start script to $daicard"
scp -i $ssh_key ops/start-daicard.sh $user@$daicard:/home/$user/start-daicard.sh

echo;echo "Running start script: bash start-daicard.sh $daicard $indra"
ssh -i $ssh_key $user@$daicard "bash -c '
  bash start-daicard.sh $daicard $indra
'"

echo;echo "Changes should be live, check out $daicard"
