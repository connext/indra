#!/usr/bin/env bash
set -e

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

project="daicard"
domainname="$1"
indra_url="$2"
proxy_image="connextproject/daicard_proxy:latest"
relay_image="connextproject/indra_relay:latest"

if [[ -z "$domainname" || -z "$indra_url" ]]
then echo "daicard domain name (1st arg) and indra url (2nd arg) are required." && exit 1
fi

docker pull $proxy_image
docker pull $relay_image

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
      RELAY_URL: http://relay:4223
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt

  relay:
    image: $relay_image
    command: ["$indra_url:4222"]

EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

docker container prune -f 2>&1 > /dev/null

echo -n "Waiting for $project to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "1" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
