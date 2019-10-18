#!/usr/bin/env bash
set -e

project="daicard"

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

INDRA_URL="${1:-https://rinkeby.indra.connext.network}"
proxy_image="connextproject/daicard_proxy:latest"

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

volumes:
  certs:

services:
  proxy:
    image: $proxy_image
    environment:
      INDRA_URL: http://daicard:3000
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt

EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for $project to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "1" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
