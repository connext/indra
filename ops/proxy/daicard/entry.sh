#!/bin/bash

if [[ "${ETH_PROVIDER_URL%%://*}" == "https" ]]
then export ETH_PROVIDER_PROTOCOL="ssl"
else export ETH_PROVIDER_PROTOCOL=""
fi

ETH_PROVIDER_URL=${ETH_PROVIDER_URL#*://}

if [[ "$ETH_PROVIDER_PROTOCOL" == "ssl" ]]
then export ETH_PROVIDER_HOST="${ETH_PROVIDER_URL%%/*}:443"
else export ETH_PROVIDER_HOST="${ETH_PROVIDER_URL%%/*}"
fi

if [[ "$ETH_PROVIDER_URL" == *"/"* ]]
then export ETH_PROVIDER_PATH="/${ETH_PROVIDER_URL#*/}"
else export ETH_PROVIDER_PATH="/"
fi

INDRA_HOST=${INDRA_URL#*://}
WEB_SERVER_HOST=${WEB_SERVER_URL#*://}

echo "Proxy container launched in env:"
echo "DOMAINNAME=$DOMAINNAME"
echo "EMAIL=$EMAIL"
echo "ETH_PROVIDER_HOST=$ETH_PROVIDER_HOST"
echo "ETH_PROVIDER_PATH=$ETH_PROVIDER_PATH"
echo "ETH_PROVIDER_PROTOCOL=$ETH_PROVIDER_PROTOCOL"
echo "ETH_PROVIDER_URL=$ETH_PROVIDER_URL"
echo "INDRA_URL=$INDRA_URL"
echo "INDRA_HOST=$INDRA_HOST"
echo "WEB_SERVER_URL=$WEB_SERVER_URL"
echo "WEB_SERVER_HOST=$WEB_SERVER_HOST"

# Provide a message indicating that we're still waiting for everything to wake up
function loading_msg {
  while true # unix.stackexchange.com/a/37762
  do echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nWaiting for proxy to wake up" | nc -lk -p 80
  done > /dev/null
}
loading_msg &
loading_pid="$!"

########################################
# Wait for downstream services to wake up
# Define service hostnames & ports we depend on

echo "waiting for $ETH_PROVIDER_HOST..."
wait-for -t 60 $ETH_PROVIDER_HOST 2> /dev/null
while ! curl -s $ETH_PROVIDER_HOST > /dev/null
do sleep 2
done

echo "waiting for $INDRA_HOST..."
wait-for -t 60 $INDRA_HOST 2> /dev/null
while ! curl -s $INDRA_URL > /dev/null
do sleep 2
done

echo "waiting for $WEB_SERVER_HOST..."
wait-for -t 60 $WEB_SERVER_HOST 2> /dev/null
while ! curl -s $WEB_SERVER_URL > /dev/null
do sleep 2
done

# Kill the loading message server
kill "$loading_pid" && pkill nc

if [[ -z "$DOMAINNAME" ]]
then
  cp /etc/ssl/cert.pem ca-certs.pem
  echo "Entrypoint finished, executing haproxy..."; echo
  exec haproxy -db -f http.cfg
fi

########################################
# Setup SSL Certs

letsencrypt=/etc/letsencrypt/live
certsdir=$letsencrypt/$DOMAINNAME
mkdir -p $certsdir
mkdir -p /etc/haproxy/certs
mkdir -p /var/www/letsencrypt

if [[ "$DOMAINNAME" == "localhost" && ! -f "$certsdir/privkey.pem" ]]
then
  echo "Developing locally, generating self-signed certs"
  openssl req -x509 -newkey rsa:4096 -keyout $certsdir/privkey.pem -out $certsdir/fullchain.pem -days 365 -nodes -subj '/CN=localhost'
fi

if [[ ! -f "$certsdir/privkey.pem" ]]
then
  echo "Couldn't find certs for $DOMAINNAME, using certbot to initialize those now.."
  certbot certonly --standalone -m $EMAIL --agree-tos --no-eff-email -d $DOMAINNAME -n
  [[ $? -eq 0 ]] || sleep 9999 # FREEZE! Don't pester eff & get throttled
fi

echo "Using certs for $DOMAINNAME"
cat $certsdir/fullchain.pem $certsdir/privkey.pem > /root/$DOMAINNAME.pem

export CERTBOT_PORT=31820

function copycerts {
  if [[ -f $certsdir/fullchain.pem && -f $certsdir/privkey.pem ]]
  then cat $certsdir/fullchain.pem $certsdir/privkey.pem > "$DOMAINNAME.pem"
  elif [[ -f "$certsdir-0001/fullchain.pem" && -f "$certsdir-0001/privkey.pem" ]]
  then cat "$certsdir-0001/fullchain.pem" "$certsdir-0001/privkey.pem" > "$DOMAINNAME.pem"
  else
    echo "Couldn't find certs, freezing to debug"
    sleep 9999;
    exit 1
  fi
}

# periodically fork off & see if our certs need to be renewed
function renewcerts {
  sleep 3 # give proxy a sec to wake up before attempting first renewal
  while true
  do
    echo -n "Preparing to renew certs... "
    if [[ -d "$certsdir" ]]
    then
      echo -n "Found certs to renew for $DOMAINNAME... "
      certbot renew -n --standalone --http-01-port=$CERTBOT_PORT
      copycerts
      echo "Done!"
    fi
    sleep 48h
  done
}

renewcerts &

copycerts

cp /etc/ssl/cert.pem ca-certs.pem

echo "Entrypoint finished, executing haproxy..."; echo
exec haproxy -db -f https.cfg
