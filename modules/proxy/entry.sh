#!/bin/bash

# Set default email & domain name
email="${EMAIL:-noreply@gmail.com}"
domain="${DOMAINNAME:-localhost}"
dashboard_url="${DASHBOARD_URL:-dashboard}"
echo "domain=$domain email=$email dashboard=$dashboard_url mode=$MODE"

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
hub=hub:8080
dashboard=dashboard:9999
dashboard_client=dashboard_client:3000

echo "Waiting for $hub to wake up..." && bash wait_for.sh -t 60 $hub 2> /dev/null
# Do a more thorough check to ensure the hub is online
while ! curl -s http://$hub/config > /dev/null
do sleep 2
done

echo "waiting for $dashboard..." && bash wait_for.sh -t 60 $dashboard 2> /dev/null
# Do a more thorough check to ensure the dashboard is online
while ! curl -s http://$dashboard > /dev/null
do sleep 2
done

if [[ "$MODE" == "dev" ]]
then
  echo "waiting for $dashboard_client..." && bash wait_for.sh -t 60 $dashboard_client 2> /dev/null
  # Do a more thorough check to ensure the dashboard is online
  while ! curl -s http://$dashboard_client > /dev/null
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
mkdir -p /etc/certs
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
ln -sf $letsencrypt/$domain/privkey.pem /etc/certs/privkey.pem
ln -sf $letsencrypt/$domain/fullchain.pem /etc/certs/fullchain.pem

# Hack way to implement variables in the nginx.conf file
sed -i 's/$hostname/'"$domain"'/' /etc/nginx/nginx.conf
sed -i 's|$ETH_RPC_URL|'"$ETH_RPC_URL"'|' /etc/nginx/nginx.conf
sed -i 's|$DASHBOARD_URL|'"$dashboard_url"'|' /etc/nginx/nginx.conf

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
then
  renewcerts &
fi

sleep 3 # give renewcerts a sec to do it's first check

echo "Entrypoint finished, executing nginx..."; echo
exec nginx
