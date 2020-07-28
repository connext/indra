#!/usr/bin/env bash
set -e

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
project="daicard"
registry="`cat $root/package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"
tmp="$root/.tmp"; mkdir -p $tmp

# Turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

# make sure a network for this project has been created
docker network create --attachable --driver overlay $project 2> /dev/null || true

########################################
## Docker registry & version config

# prod version: if we're on a tagged commit then use the tagged semvar, otherwise use the hash
if [[ "$DAICARD_ENV" == "prod" ]]
then
  git_tag="`git tag --points-at HEAD | grep "indra-" | head -n 1`"
  if [[ -n "$git_tag" ]]
  then version="`echo $git_tag | sed 's/indra-//'`"
  else version="`git rev-parse HEAD | head -c 8`"
  fi
else version="latest"
fi

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then
    if [[ -n "`echo $1 | grep "${project}_"`" ]]
    then full_name="${registry%/}/$1"
    else full_name="$1"
    fi
    echo "Can't find image $1 locally, attempting to pull $full_name"
    docker pull $full_name
    docker tag $full_name $1
  fi
}

# Initialize new secrets (random if no value is given)
function new_secret {
  secret="$2"
  if [[ -z "$secret" ]]
  then secret=`head -c 32 /dev/urandom | xxd -plain -c 32 | tr -d '\n\r'`
  fi
  if [[ -z "`docker secret ls -f name=$1 | grep -w $1`" ]]
  then
    id=`echo "$secret" | tr -d '\n\r' | docker secret create $1 -`
    echo "Created secret called $1 with id $id"
  fi
}

echo "Using docker images ${project}_name:${version} "

####################
# Proxy config

email="${DAICARD_EMAIL:-noreply@gmail.com}"
indra_url="${DAICARD_INDRA_URL:-http://172.17.0.1:3000}"

proxy_image="${project}_proxy:$version";
pull_if_unavailable "$proxy_image"


if [[ -z "$INDRA_DOMAINNAME" ]]
then
  public_url="http://localhost:3001"
  proxy_ports="ports:
      - '3001:80'"
else
  public_url="https://localhost:443"
  proxy_ports="ports:
      - '80:80'
      - '443:443'"
fi

echo "Proxy configured"

####################
# Webserver config

if [[ $DAICARD_ENV == "prod" ]]
then
  webserver_image_name="${project}_webserver:$version"
  pull_if_unavailable "$webserver_image_name"
  webserver_image="image: '$webserver_image_name'"
else
  webserver_image="image: 'indra_builder'
    entrypoint: bash -c 'cd modules/daicard && npm run start'
    volumes:
      - '$root:/root'"
fi

####################
# Launch Daicard stack

echo "Launching ${project}"

common="networks:
      - '$project'
    logging:
      driver: 'json-file'
      options:
          max-size: '100m'"

cat - > $root/${project}.docker-compose.yml <<EOF
version: '3.4'

networks:
  $project:
    external: true

volumes:
  certs:

services:

  ${project}:
    $common
    $proxy_ports
    image: '$proxy_image'
    environment:
      DAICARD_DOMAINNAME: '$DAICARD_DOMAINNAME'
      DAICARD_EMAIL: '$email'
      DAICARD_INDRA_URL: '$indra_url'
      DAICARD_ETH_PROVIDER_URL: 'http://172.17.0.1:8545'
      DAICARD_WEB_SERVER_URL: 'http://webserver:3000'
    volumes:
      - 'certs:/etc/letsencrypt'

  webserver:
    $common
    $webserver_image

EOF

docker stack deploy -c $root/${project}.docker-compose.yml $project

echo "The $project stack has been deployed, waiting for the proxy to start responding.."
timeout=$(expr `date +%s` + 180)
while true
do
  res="`curl -k -m 5 -s $public_url || true`"
  if [[ -z "$res" || "$res" == "Waiting for proxy to wake up" ]]
  then
    if [[ "`date +%s`" -gt "$timeout" ]]
    then echo "Timed out waiting for proxy to respond.." && exit
    else sleep 2
    fi
  else echo "Good Morning!" && exit;
  fi
done
