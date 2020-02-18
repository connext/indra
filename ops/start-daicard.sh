#!/usr/bin/env bash
set -e

# This script is intended to be a standalone that can run w/out needing any deps
# So eg don't fetch project/registry names from package.json bc that might not be available

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

project="daicard"
domainname="$1"
indra_url="$2"
proxy_image="connextproject/daicard_proxy:latest"

if [[ -z "$domainname" || -z "$indra_url" ]]
then echo "daicard domain name (1st arg) and indra url (2nd arg) are required." && exit 1
fi

docker pull $proxy_image

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

volumes:
  certs:

services:
  proxy:
    image: $proxy_image
    environment:
      DOMAINNAME: $domainname
      INDRA_URL: $indra_url
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

docker container prune -f 2>&1 > /dev/null

echo -n "Waiting for $project to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "1" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
