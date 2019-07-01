#!/bin/bash

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}' | tr -d '-'`"
number_of_services=2
proxy_image="${project}_proxy:dev"
server_image="${project}_builder"

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'
volumes:
  certs:
services:
  proxy:
    image: $proxy_image
    environment:
      MODE: dev
      LOCAL_HUB_URL: http://172.17.0.1:3000
    ports:
      - "80:80"
    volumes:
      - certs:/etc/letsencrypt
  server:
    image: $server_image
    entrypoint: npm start
    volumes:
      - `pwd`:/root
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
