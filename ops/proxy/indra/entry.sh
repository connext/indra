#!/bin/bash

# Set default email & domain name
domain="${DOMAINNAME:-localhost}"
email="${EMAIL:-noreply@gmail.com}"
ETH_RPC_URL="${ETH_RPC_URL:-http://ethprovider:8545}"
MESSAGING_URL="${MESSAGING_URL:-http://nats:4221}"
mode="${MODE:-dev}"
NODE_URL="${NODE_URL:-http://node:8080}"
WEBSERVER_URL="${WEBSERVER_URL:-http://webserver:80}"

echo "domain=$domain mode=$mode email=$email eth=$ETH_RPC_URL messaging=$MESSAGING_URL ui=$WEBSERVER_URL node=$NODE_URL"

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

echo "waiting for ${ETH_RPC_URL#*://}..."
bash wait_for.sh -t 60 ${ETH_RPC_URL#*://} 2> /dev/null
while ! curl -s $ETH_RPC_URL > /dev/null
do sleep 2
done

echo "waiting for ${MESSAGING_URL#*://}..."
bash wait_for.sh -t 60 ${MESSAGING_URL#*://} 2> /dev/null

echo "waiting for ${NODE_URL#*://}..."
bash wait_for.sh -t 60 ${NODE_URL#*://} 2> /dev/null
while ! curl -s $NODE_URL > /dev/null
do sleep 2
done

if [[ "$mode" == "dev" ]]
then
  echo "waiting for ${WEBSERVER_URL#*://}..."
  bash wait_for.sh -t 60 ${WEBSERVER_URL#*://} 2> /dev/null
  # Do a more thorough check to ensure the dashboard is online
  while ! curl -s $WEBSERVER_URL > /dev/null
  do sleep 2
  done
fi

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

if [[ "$domain" == "localhost" && ! -f "$devcerts/privkey.pem" ]]
then
  echo "Developing locally, generating self-signed certs"
  openssl req -x509 -newkey rsa:4096 -keyout $devcerts/privkey.pem -out $devcerts/fullchain.pem -days 365 -nodes -subj '/CN=localhost'
fi

if [[ ! -f "$letsencrypt/$domain/privkey.pem" ]]
then
  echo "Couldn't find certs for $domain, using certbot to initialize those now.."
  certbot certonly --standalone -m $email --agree-tos --no-eff-email -d $domain -n
  [[ $? -eq 0 ]] || sleep 9999 # FREEZE! Don't pester eff & get throttled
fi

echo "Using certs for $domain"
ln -sf $letsencrypt/$domain/fullchain.pem /etc/ssl/certs/fullchain.pem
ln -sf $letsencrypt/$domain/privkey.pem /etc/ssl/private/privkey.pem

# Hack way to implement variables in the haproxy.conf file
sed -i 's/$hostname/'"$domain"'/' /root/haproxy.conf
sed -i 's|$WEBSERVER_URL|'"$WEBSERVER_URL"'|' /root/haproxy.conf
sed -i 's|$ETH_RPC_URL|'"$ETH_RPC_URL"'|' /root/haproxy.conf
sed -i 's|$MESSAGING_URL|'"$MESSAGING_URL"'|' /root/haproxy.conf
sed -i 's|$NODE_URL|'"$NODE_URL"'|' /root/haproxy.conf

# periodically fork off & see if our certs need to be renewed
function renewcerts {
  while true
  do
    echo -n "Preparing to renew certs... "
    if [[ -d "/etc/letsencrypt/live/$domain" ]]
    then
      echo -n "Found certs to renew for $domain... "
      certbot renew --webroot -w /var/www/letsencrypt/ -n
      echo "Done!"
    fi
    sleep 48h
  done
}

if [[ "$domain" != "localhost" ]]
then renewcerts &
fi

sleep 3 # give renewcerts a sec to do it's first check

echo "Entrypoint finished, executing haproxy..."; echo
exec haproxy -f haproxy.cfg
