#!/bin/bash

# Set default email & domain name
email="${EMAIL:-noreply@gmail.com}"
domain="${DOMAINNAME:-localhost}"
local_hub="${LOCAL_HUB_URL:-http://indra_proxy}"
rinkeby_hub="${RINKEBY_HUB_URL:-$local_hub}"
mainnet_hub="${MAINNET_HUB_URL:-$rinkeby_hub}"
echo "domain=$domain email=$email"
echo "local_hub=$local_hub rinkeby_hub=$rinkeby_hub mainnet_hub=$mainnet_hub"

# Hacky way to implement variables in the nginx.conf file
sed -i 's/$hostname/'"$domain"'/' /etc/nginx/nginx.conf
sed -i 's|$LOCAL_HUB_URL|'"$local_hub"'|' /etc/nginx/nginx.conf
sed -i 's|$RINKEBY_HUB_URL|'"$rinkeby_hub"'|' /etc/nginx/nginx.conf
sed -i 's|$MAINNET_HUB_URL|'"$mainnet_hub"'|' /etc/nginx/nginx.conf

letsencrypt=/etc/letsencrypt/live
devcerts=$letsencrypt/localhost
mkdir -p $devcerts
mkdir -p /etc/certs
mkdir -p /var/www/letsencrypt

loading_page='<!doctype html><html lang=en>
<head><meta charset=utf-8><title>Loading...</title></head>
<body><h1>Waiting for the rest of the app to wake up...</h1></body>
</html>'

# Provide a message indicating that we're still waiting for everything to wake up
function loading_msg {
  while true # unix.stackexchange.com/a/37762
  do echo "$loading_page" | nc -lk -p 80
  done > /dev/null
}
loading_msg &
loading_pid="$!"

if [[ "$MODE" == "dev" ]]
then

  hub=${local_hub#*://}
  echo "Waiting for $hub to wake up... (have you run npm start in the indra repo yet?)"
  bash wait_for.sh -t 60 $hub 2> /dev/null
  while ! curl -s http://$hub > /dev/null
  do sleep 1
  done

  server=server:3000
  echo "Waiting for $server to wake up..."
  bash wait_for.sh -t 60 $server 2> /dev/null
  while ! curl -s http://$server > /dev/null
  do sleep 1
  done

else

  hub=$rinkeby_hub
  echo "Waiting for $hub to wake up... (have you deployed indra yet?)"
  while ! curl -s $hub > /dev/null
  do sleep 1
  done

  # TODO: After mainnet launch, ensure the mainnet hub is awake too

fi

# Kill the loading message
kill "$loading_pid" && pkill nc

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
