#!/bin/bash

# Set default email & domain name
DOMAINNAME="${DOMAINNAME:-localhost}"
EMAIL="${EMAIL:-noreply@gmail.com}"
MODE="${MODE:-dev}"

ETH_RPC_URL="${ETH_RPC_URL:-ethprovider:8545}"
MESSAGING_URL="${MESSAGING_URL:-nats:4221}"
NODE_URL="${NODE_URL:-node:8080}"
WEBSERVER_URL="${WEBSERVER_URL:-webserver:3000}"

echo "domain=$DOMAINNAME mode=$MODE email=$EMAIL eth=$ETH_RPC_URL messaging=$MESSAGING_URL ui=$WEBSERVER_URL node=$NODE_URL"

# Provide a message indicating that we're still waiting for everything to wake up
function loading_msg {
  while true # unix.stackexchange.com/a/37762
  do echo 'Waiting for the rest of the app to wake up..' | nc -lk -p 80
  done > /dev/null
}
loading_msg &
loading_pid="$!"

########################################
# Wait for downstream services to wake up
# Define service hostnames & ports we depend on

echo "waiting for $ETH_RPC_URL..."
bash wait_for.sh -t 60 $ETH_RPC_URL 2> /dev/null
while ! curl -s $ETH_RPC_URL > /dev/null
do sleep 2
done

echo "waiting for $MESSAGING_URL..."
bash wait_for.sh -t 60 $MESSAGING_URL 2> /dev/null

echo "waiting for $NODE_URL..."
bash wait_for.sh -t 60 $NODE_URL 2> /dev/null
while ! curl -s $NODE_URL > /dev/null
do sleep 2
done

echo "waiting for $WEBSERVER_URL..."
bash wait_for.sh -t 60 $WEBSERVER_URL 2> /dev/null
# Do a more thorough check to ensure the dashboard is online
while ! curl -s $WEBSERVER_URL > /dev/null
do sleep 2
done

# Kill the loading message server
kill "$loading_pid" && pkill nc

########################################
# Setup SSL Certs

letsencrypt=/etc/letsencrypt/live
devcerts=$letsencrypt/localhost
mkdir -p $devcerts
mkdir -p /etc/ssl/certs
mkdir -p /etc/ssl/private
mkdir -p /var/www/letsencrypt

if [[ "$DOMAINNAME" == "localhost" && ! -f "$devcerts/privkey.pem" ]]
then
  echo "Developing locally, generating self-signed certs"
  openssl req -x509 -newkey rsa:4096 -keyout $devcerts/privkey.pem -out $devcerts/fullchain.pem -days 365 -nodes -subj '/CN=localhost'
fi

if [[ ! -f "$letsencrypt/$DOMAINNAME/privkey.pem" ]]
then
  echo "Couldn't find certs for $DOMAINNAME, using certbot to initialize those now.."
  certbot certonly --standalone -m $EMAIL --agree-tos --no-eff-email -d $DOMAINNAME -n
  [[ $? -eq 0 ]] || sleep 9999 # FREEZE! Don't pester eff & get throttled
fi

echo "Using certs for $DOMAINNAME"
ln -sf $letsencrypt/$DOMAINNAME/fullchain.pem /etc/ssl/certs/fullchain.pem
ln -sf $letsencrypt/$DOMAINNAME/privkey.pem /etc/ssl/private/privkey.pem

# periodically fork off & see if our certs need to be renewed
function renewcerts {
  while true
  do
    echo -n "Preparing to renew certs... "
    if [[ -d "/etc/letsencrypt/live/$DOMAINNAME" ]]
    then
      echo -n "Found certs to renew for $DOMAINNAME... "
      certbot renew --webroot -w /var/www/letsencrypt/ -n
      echo "Done!"
    fi
    sleep 48h
  done
}

if [[ "$DOMAINNAME" != "localhost" ]]
then
  renewcerts &
  sleep 3 # give renewcerts a sec to do it's first check
fi

echo "Entrypoint finished, executing haproxy..."; echo
exec haproxy -db -f $MODE.cfg
