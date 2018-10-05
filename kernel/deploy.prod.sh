#!/usr/bin/env bash

# eth settings
CONTRACT_ADDRESS=0xf25186B5081Ff5cE73482AD761DB0eB0d25abfBF
ETH_NETWORK_ID=4447
ETH_NODE_PROTOCOL=http://
ETH_NODE_HOST=host.docker.internal
ETH_NODE_PORT=8545
ETH_NODE_URL=${ETH_NODE_PROTOCOL}${ETH_NODE_HOST}:${ETH_NODE_PORT}
HUB_ACCOUNT=0x627306090abab3a6e1400e9345bc60c78a8bef57

# image settings
repository=connextproject
project=connext
hub_image=${repository}/${project}_hub:latest
chainsaw_image=${repository}/${project}_chainsaw:latest
database_image=postgres:10

# typeorm
TYPEORM_HOST=postgres
TYPEORM_PORT=5432
TYPEORM_DATABASE=$project
TYPEORM_USERNAME=$project
TYPEORM_PASSWORD_FILE=/run/secrets/connext_db_dev

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null

function pull_if_unavailable {
    if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
    then
        docker pull $1
    fi
}

pull_if_unavailable $database_image
pull_if_unavailable $hub_image
pull_if_unavailable $chainsaw_image

function new_secret {
    secret=$2
    if [[ -z "$secret" ]]
    then
        secret=`head -c 32 /dev/urandom | xxd -plain -c 32 | tr -d '\n\r'`
    fi
    if [[ -z "`docker secret ls -f name=$1 | grep -w $1`" ]]
    then
        id=`echo $secret | tr -d '\n\r' | docker secret create $1 -`
        echo "Created secret called $1 with id $id"
    fi
}

new_secret connext_db_dev

mkdir -p ~/ethereum

mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  connext_db_dev:
    external: true

volumes:
  data:

services:
  hub:
    image: $hub_image
    ports:
      - '3000:3000'
    depends_on:
      - postgres
      - ganache
      - chainsaw
    secrets:
      - connext_db_dev
    environment:
      NODE_ENV: development
      ETH_NODE_URL: $ETH_NODE_URL
      HUB_ACCOUNT: $HUB_ACCOUNT
      CONTRACT_ADDRESS: $CONTRACT_ADDRESS
      TYPEORM_HOST: $TYPEORM_HOST
      TYPEORM_PORT: $TYPEORM_PORT
      TYPEORM_DATABASE: $TYPEORM_DATABASE
      TYPEORM_USERNAME: $TYPEORM_USERNAME
      TYPEORM_PASSWORD_FILE: $TYPEORM_PASSWORD_FILE
      TYPEORM_LOGGING: "true"

  chainsaw:
    image: $chainsaw_image
    ports:
      - '3001:3001'
    depends_on:
      - postgres
      - ganache
    secrets:
      - connext_db_dev
    environment:
      NODE_ENV: development
      ETH_NETWORK_ID: $ETH_NETWORK_ID
      ETH_NODE_PROTOCOL: $ETH_NODE_PROTOCOL
      ETH_NODE_HOST: $ETH_NODE_HOST
      ETH_NODE_PORT: $ETH_NODE_PORT
      POLLING_INTERVAL: 2000
      CONTRACT_ADDRESS: $CONTRACT_ADDRESS
      TYPEORM_HOST: $TYPEORM_HOST
      TYPEORM_PORT: $TYPEORM_PORT
      TYPEORM_DATABASE: $TYPEORM_DATABASE
      TYPEORM_USERNAME: $TYPEORM_USERNAME
      TYPEORM_PASSWORD_FILE: $TYPEORM_PASSWORD_FILE
      TYPEORM_LOGGING: "true"

  postgres:
    image: postgres:10
    ports:
      - '5432:5432'
    deploy:
      mode: global
    secrets:
      - connext_db_dev
    environment:
      POSTGRES_USER: $TYPEORM_USERNAME
      POSTGRES_DB: $TYPEORM_DATABASE
      POSTGRES_PASSWORD_FILE: $TYPEORM_PASSWORD_FILE
    volumes:
      - data:/var/lib/postgresql/data
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project
rm -rf /tmp/$project

echo -n "Waiting for the $project stack to wake up."
number_of_services=3
while true
do
    sleep 3
    if [[ "`docker container ls | grep $project | wc -l | sed 's/ //g'`" == "$number_of_services" ]]
    then
        echo " Good Morning!"
        break
    else
        echo -n "."
    fi
done

