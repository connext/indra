#!/usr/bin/env bash
set -e

# turn on swarm mode if it's not already on
docker swarm init 2> /dev/null || true

####################
# External Env Vars

INDRA_AWS_ACCESS_KEY_ID="${INDRA_AWS_ACCESS_KEY_ID:-}"
INDRA_AWS_SECRET_ACCESS_KEY="${INDRA_AWS_SECRET_ACCESS_KEY:-}"
INDRA_DOMAINNAME="${INDRA_DOMAINNAME:-localhost}"
INDRA_EMAIL="${INDRA_EMAIL:-noreply@gmail.com}" # for notifications when ssl certs expire
INDRA_ETH_PROVIDER="${INDRA_ETH_PROVIDER}"
INDRA_LOGDNA_KEY="${INDRA_LOGDNA_KEY:-abc123}"
INDRA_MODE="${INDRA_MODE:-release}" # One of: release, staging, test-staging, or test-release
INDRA_ADMIN_TOKEN="${INDRA_ADMIN_TOKEN:-cxt1234}" # pass this in through CI

####################
# Internal Config

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project="`cat $dir/../package.json | grep '"name":' | head -n 1 | cut -d '"' -f 4`"
registry="`cat $dir/../package.json | grep '"registry":' | head -n 1 | cut -d '"' -f 4`"

ganache_chain_id="4447"
log_level="3" # set to 5 for all logs or to 0 for none
node_port="8080"
number_of_services="6" # NOTE: Gotta update this manually when adding/removing services :(

####################
# Helper Functions

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

# Get images that we aren't building locally
function pull_if_unavailable {
  if [[ -z "`docker image ls | grep ${1%:*} | grep ${1#*:}`" ]]
  then
    # But actually don't pull images if we're running locally
    if [[ "$INDRA_DOMAINNAME" != "localhost" ]]
    then docker pull $1
    fi
  fi
}

########################################
## Database Conig

if [[ "$INDRA_MODE" == "test"* ]]
then
  db_volume="database_test_`date +%y%m%d_%H%M%S`"
  db_secret="${project}_database_test"
  new_secret "$db_secret" "$project"
  db_port='ports:
      - "5432:5432"
  '
else
  db_volume="database"
  db_secret="${project}_database"
  new_secret $db_secret
fi

# database connection settings
pg_db="$project"
pg_host="database"
pg_password_file="/run/secrets/$db_secret"
pg_port="5432"
pg_user="$project"

# nats bearer auth settings
nats_port="4222"
nats_ws_port="4221"

# redis settings
redis_url="redis://redis:6379"

########################################
## Docker Image Config

if [[ "$INDRA_MODE" == "test"* ]]
then registry=""
else registry="${registry%/}/"
fi

if [[ "$INDRA_MODE" == *"staging" ]]
then version="`git rev-parse HEAD | head -c 8`"
elif [[ "$INDRA_MODE" == *"release" ]]
then version="`cat $dir/../package.json | grep '"version":' | head -n 1 | cut -d '"' -f 4`"
else echo "Unknown mode ($INDRA_MODE) for domain: $INDRA_DOMAINNAME. Aborting" && exit 1
fi

database_image="$registry${project}_database:$version"
ethprovider_image="$registry${project}_ethprovider:$version"
logdna_image="logdna/logspout:v1.2.0"
nats_image="provide/nats-server:indra"
node_image="$registry${project}_node:$version"
proxy_image="$registry${project}_proxy:$version"
redis_image="redis:5-alpine"

pull_if_unavailable "$database_image"
pull_if_unavailable "$ethprovider_image"
pull_if_unavailable "$logdna_image"
pull_if_unavailable "$nats_image"
pull_if_unavailable "$node_image"
pull_if_unavailable "$proxy_image"
pull_if_unavailable "$redis_image"

########################################
## Ethereum Config

eth_mnemonic_name="${project}_mnemonic"

if [[ -z "$INDRA_ETH_PROVIDER" ]]
then echo "An env var called INDRA_ETH_PROVIDER is required" && exit 1
elif [[ "$INDRA_ETH_PROVIDER" =~ .*://localhost:.* ]]
then chainId="$ganache_chain_id"
else chainId="`curl -q -k -s -H "Content-Type: application/json" -X POST --data '{"id":1,"jsonrpc":"2.0","method":"net_version","params":[]}' $INDRA_ETH_PROVIDER | jq .result | tr -d '"'`"
fi

echo "eth provider: $INDRA_ETH_PROVIDER w chainId: $chainId"

# Prefer top-level address-book override otherwise default to one in contracts
if [[ -f address-book.json ]]
then eth_contract_addresses="`cat address-book.json | tr -d ' \n\r'`"
else eth_contract_addresses="`cat modules/contracts/address-book.json | tr -d ' \n\r'`"
fi

token_address="`echo $eth_contract_addresses | jq '.["'"$chainId"'"].Token.address' | tr -d '"'`"

if [[ "$chainId" == "$ganache_chain_id" ]]
then
  eth_mnemonic="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  new_secret "$eth_mnemonic_name" "$eth_mnemonic"
  eth_volume="chain_dev:"
  number_of_services=$(( $number_of_services + 1 ))
  ethprovider_service="
  ethprovider:
    image: $ethprovider_image
    command: \"start\"
    environment:
      ETH_MNEMONIC: $eth_mnemonic
    ports:
      - 8545:8545
    volumes:
      - $eth_volume/data
  "
  INDRA_ETH_PROVIDER="http://ethprovider:8545"
  pull_if_unavailable "$ethprovider_image"
  MODE=${INDRA_MODE#*-} bash ops/deploy-contracts.sh
fi

allowed_swaps="[{\"from\":\"$token_address\",\"to\":\"0x0000000000000000000000000000000000000000\",\"priceOracleType\":\"UNISWAP\"},{\"from\":\"0x0000000000000000000000000000000000000000\",\"to\":\"$token_address\",\"priceOracleType\":\"UNISWAP\"}]"

nats_jwt_signer_privkey='-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAqU/GXp8MqmugQyRk5FUFBvlJt1/h7L3Crzlzejz/OxriZdq/\nlBNQW9S1kzGc7qjXprZ1Kg3zP6irr6wmvP0WYBGltWs2cWUAmxh0PSxuKdT/OyL9\nw+rjKLh4yo3ex6DX3Ij0iP01Ej2POe5WrPDS8j6LT0s4HZ1FprL5h7RUQWV3cO4p\nF+1kl6HlBpNzEQzocW9ig4DNdSeUENARHWoCixE1gFYo9RXm7acqgqCk3ihdJRIb\nO4e/m1aZq2mvAFK+yHTIWBL0p5PF0Fe8zcWdNeEATYB+eRdNJ3jjS8447YrcbQcB\nQmhFjk8hbCnc3Rv3HvAapk8xDFhImdVF1ffDFwIDAQABAoIBAGZIs2ZmX5h0/JST\nYAAw/KCB6W7Glg4XdY21/3VRdD+Ytj0iMaqbIGjZz/fkeRIVHnKwt4d4dgN3OoEe\nVyjFHMdc4eb/phxLEFqiI1bxiHvtGWP4d6XsON9Y0mBL5NJk8QNiGZjIn08tsWEm\nA2bm9gkyj6aPoo8BfBqA9Q5uepgmYIPT2NtEXvTbd2dedAEJDJspHKHqBfcuNBVo\nVhUixVSgehWGGP4GX+FvAEHbawDrwULkMvgblH+X8nBtzikp29LNpOZSRRbqF/Da\n0AkluFvuDUUIzitjZs5koSEAteaulkZO08BMxtovQjh/ZPtVZKZ27POCNOgRsbm/\nlVIXRMECgYEA2TQQ2Xy6eO5XfbiT4ZD1Z1xe9B6Ti7J2fC0ZNNSXs4DzdYVcHNIu\nZqfK6fGqmByvSnFut7n5Po0z2FdXc7xcKFJdBZdFP3GLXbN9vpRPIk9b6n+0df47\n1uTYwVocmAGXez++y73j5XzHQQW4WmmC5SlKjQUWCGkuzISVjRDtlZ0CgYEAx43K\nPrJxSijjE2+VWYjNFVuv6KilnWoA8I2cZ7TtPi4h//r5vyOUst0egR3lJ7rBof74\nVttQPvqAk3GN697IrE/bSwefwG2lM1Ta0KB3jn6b/iT4ckmaOB+v6aDHq/GPW6l/\nsxD0RIEelRYZlsNLepRgKhcQckhjnWzQuGWSl0MCgYBYJQ0BdeCm2vKejp1U2OL+\nQzo1j4MJGi+DTToBepTlv9sNQkWTXKh/+HAcaHp2qI1qhIYOAWbov5zemvNegH5V\nzrb5Yd40VPvd1s2c3csPfW0ryQ+PItFd8BkWvl8EQQEcf04KmNE3fF/QP2YFKvR3\n0z3x5LKAT08yqEuYp9oC8QKBgQCfc9XqGU3bEya3Lg8ptt0gtt2ty6xiRwSvMoiK\neZCkgdpbH6EWMQktjvBD/a5Q+7KjjgfD54SMfj/lEPR1R9QTk8/HeTUWXsaFaMVb\ntQ0zSEm/Xq1DLTrUo8U9qmJCK0gA10SZwe9dGctlF36k8DJMpWjd2QYkO2GVthBl\nd4wV3wKBgC7S4q0wmcrQIjyDIFmISQNdOAJhR0pJXG8mK2jECbEXxbKkAJnLj73D\nJ+1OVBlx4HXx54PiEkV3M3iTinf5tBSi8nA2D3s829F65XKFli1RC4rJv+2ygH8P\nnXX9rQKhK/v6/jeelKquH8zy894hLZe7feSsWV9GMgb5l9p+UzWB\n-----END RSA PRIVATE KEY-----' # FIXME-- read from configuration
nats_jwt_signer_pubkey='-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqU/GXp8MqmugQyRk5FUF\nBvlJt1/h7L3Crzlzejz/OxriZdq/lBNQW9S1kzGc7qjXprZ1Kg3zP6irr6wmvP0W\nYBGltWs2cWUAmxh0PSxuKdT/OyL9w+rjKLh4yo3ex6DX3Ij0iP01Ej2POe5WrPDS\n8j6LT0s4HZ1FprL5h7RUQWV3cO4pF+1kl6HlBpNzEQzocW9ig4DNdSeUENARHWoC\nixE1gFYo9RXm7acqgqCk3ihdJRIbO4e/m1aZq2mvAFK+yHTIWBL0p5PF0Fe8zcWd\nNeEATYB+eRdNJ3jjS8447YrcbQcBQmhFjk8hbCnc3Rv3HvAapk8xDFhImdVF1ffD\nFwIDAQAB\n-----END PUBLIC KEY-----'

########################################
## Deploy according to configuration

echo "Deploying node image: $node_image to $INDRA_DOMAINNAME"

mkdir -p `pwd`/ops/database/snapshots
mkdir -p /tmp/$project
cat - > /tmp/$project/docker-compose.yml <<EOF
version: '3.4'

secrets:
  $db_secret:
    external: true
  $eth_mnemonic_name:
    external: true

volumes:
  certs:
  $db_volume:
  $eth_volume

services:
  $ethprovider_service

  proxy:
    image: $proxy_image
    environment:
      DOMAINNAME: $INDRA_DOMAINNAME
      EMAIL: $INDRA_EMAIL
      ETH_RPC_URL: $INDRA_ETH_PROVIDER
      MESSAGING_URL: http://nats:4221
      NODE_URL: http://node:8080
      MODE: prod
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/letsencrypt

  node:
    image: $node_image
    entrypoint: bash ops/entry.sh
    environment:
      INDRA_ADMIN_TOKEN: $INDRA_ADMIN_TOKEN
      INDRA_ALLOWED_SWAPS: '$allowed_swaps'
      INDRA_ETH_CONTRACT_ADDRESSES: '$eth_contract_addresses'
      INDRA_ETH_MNEMONIC_FILE: /run/secrets/$eth_mnemonic_name
      INDRA_ETH_RPC_URL: $INDRA_ETH_PROVIDER
      INDRA_LOG_LEVEL: $log_level
      INDRA_NATS_CLUSTER_ID: abc123
      INDRA_NATS_JWT_SIGNER_PRIVATE_KEY: $nats_jwt_signer_privkey
      INDRA_NATS_JWT_SIGNER_PUBLIC_KEY: $nats_jwt_signer_pubkey
      INDRA_NATS_SERVERS: nats://nats:$nats_port
      INDRA_NATS_WS_ENDPOINT: wss://nats:$nats_ws_port
      INDRA_NATS_TOKEN: abc123
      INDRA_PG_DATABASE: $pg_db
      INDRA_PG_HOST: $pg_host
      INDRA_PG_PASSWORD_FILE: $pg_password_file
      INDRA_PG_PORT: $pg_port
      INDRA_PG_USERNAME: $pg_user
      INDRA_PORT: $node_port
      INDRA_REDIS_URL: $redis_url
      NODE_ENV: production
      NODE_TLS_REJECT_UNAUTHORIZED: 0
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    secrets:
      - $db_secret
      - $eth_mnemonic_name

  database:
    image: $database_image
    deploy:
      mode: global
    environment:
      AWS_ACCESS_KEY_ID: $INDRA_AWS_ACCESS_KEY_ID
      AWS_SECRET_ACCESS_KEY: $INDRA_AWS_SECRET_ACCESS_KEY
      ETH_NETWORK: $chainId
      POSTGRES_DB: $project
      POSTGRES_PASSWORD_FILE: $pg_password_file
      POSTGRES_USER: $project
    secrets:
      - $db_secret
    volumes:
      - $db_volume:/var/lib/postgresql/data
      - `pwd`/ops/database/snapshots:/root/snapshots
    $db_port

  nats:
    image: $nats_image
    command: -D -V -wstls
    environment:
      JWT_SIGNER_PUBLIC_KEY: "$nats_jwt_signer_pubkey"
      NODE_TLS_REJECT_UNAUTHORIZED: 0
    logging:
      driver: "json-file"
      options:
          max-file: 10
          max-size: 10m
    ports:
      - "$nats_port:$nats_port"
      - "$nats_ws_port:$nats_ws_port"

  redis:
    image: $redis_image
    ports:
      - "6379:6379"

  logdna:
    image: $logdna_image
    environment:
      LOGDNA_KEY: $INDRA_LOGDNA_KEY
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
EOF

docker stack deploy -c /tmp/$project/docker-compose.yml $project

echo -n "Waiting for the $project stack to wake up."
while [[ "`docker container ls | grep $project | wc -l | tr -d ' '`" != "$number_of_services" ]]
do echo -n "." && sleep 2
done
echo " Good Morning!"
