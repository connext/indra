#!/bin/bash

########################################
## External Env Vars

DAICARD_DOMAINNAME="${DAICARD_DOMAINNAME:-localhost}"
DAICARD_EMAIL="${DAICARD_EMAIL:-noreply@gmail.com}"
DAICARD_LOCAL_HUB_URL="" # Not available in prod, prevented by CORS
DAICARD_MAINNET_HUB_URL="${DAICARD_MAINNET_HUB_URL:-https://hub.connext.network}"
DAICARD_MODE="${DAICARD_MODE:-staging}"
DAICARD_RINKEBY_HUB_URL="${DAICARD_RINKEBY_HUB_URL:-https://rinkeby.hub.connext.network}"

########################################
## Internal Config

number_of_services=1

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}' | tr -d '-'`"
version="`cat package.json | grep '"version":' | egrep -o '[.0-9]+'`"

if [[ "$DAICARD_MODE" == "test" ]]
then image=daicard:test
elif [[ "$DAICARD_DOMAINNAME" == "localhost" ]]
then image=daicard:latest
else
  if [[ "$DAICARD_MODE" == "live" ]]
  then image=docker.io/connextproject/daicard:$version
  else image=docker.io/connextproject/daicard:latest
  fi
  docker pull $image
fi

####################
# Deploy according to above configuration

echo "Deploying image: $image to domain $DAICARD_DOMAINNAME linked to rinkeby hub $DAICARD_RINKEBY_HUB_URL and mainnet hub $DAICARD_MAINNET_HUB_URL"

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'
volumes:
  certs:
services:
  proxy:
    image: $image
    environment:
      DOMAINNAME: $DAICARD_DOMAINNAME
      EMAIL: $DAICARD_EMAIL
      RINKEBY_HUB_URL: $DAICARD_RINKEBY_HUB_URL
      MAINNET_HUB_URL: $DAICARD_MAINNET_HUB_URL
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
while true
do
  num_awake="`docker container ls | grep $project | wc -l | sed 's/ //g'`"
  sleep 3
  if [[ "$num_awake" == "$number_of_services" ]]
  then break
  else echo -n "."
  fi
done
echo " Good Morning!"
sleep 3

