#!/bin/bash

if [[ "${DAICARD_ETH_PROVIDER_URL%%://*}" == "https" ]]
then export DAICARD_ETH_PROVIDER_PROTOCOL="ssl"
else export DAICARD_ETH_PROVIDER_PROTOCOL=""
fi

DAICARD_ETH_PROVIDER_URL=${DAICARD_ETH_PROVIDER_URL#*://}

if [[ "$DAICARD_ETH_PROVIDER_PROTOCOL" == "ssl" ]]
then export DAICARD_ETH_PROVIDER_HOST="${DAICARD_ETH_PROVIDER_URL%%/*}:443"
else export DAICARD_ETH_PROVIDER_HOST="${DAICARD_ETH_PROVIDER_URL%%/*}"
fi

if [[ "$DAICARD_ETH_PROVIDER_URL" == *"/"* ]]
then export DAICARD_ETH_PROVIDER_PATH="/${DAICARD_ETH_PROVIDER_URL#*/}"
else export DAICARD_ETH_PROVIDER_PATH="/"
fi

DAICARD_INDRA_HOST=${DAICARD_INDRA_URL#*://}
DAICARD_WEB_SERVER_HOST=${DAICARD_WEB_SERVER_URL#*://}

echo "Proxy container launched in env:"
echo "DAICARD_DOMAINNAME=$DAICARD_DOMAINNAME"
echo "DAICARD_EMAIL=$DAICARD_EMAIL"
echo "DAICARD_ETH_PROVIDER_HOST=$DAICARD_ETH_PROVIDER_HOST"
echo "DAICARD_ETH_PROVIDER_PATH=$DAICARD_ETH_PROVIDER_PATH"
echo "DAICARD_ETH_PROVIDER_PROTOCOL=$DAICARD_ETH_PROVIDER_PROTOCOL"
echo "DAICARD_ETH_PROVIDER_URL=$DAICARD_ETH_PROVIDER_URL"
echo "DAICARD_INDRA_HOST=$DAICARD_INDRA_HOST"
echo "DAICARD_INDRA_URL=$DAICARD_INDRA_URL"
echo "DAICARD_WEB_SERVER_HOST=$DAICARD_WEB_SERVER_HOST"
echo "DAICARD_WEB_SERVER_URL=$DAICARD_WEB_SERVER_URL"

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

echo "waiting for $DAICARD_ETH_PROVIDER_HOST..."
wait-for -t 60 $DAICARD_ETH_PROVIDER_HOST 2> /dev/null
while ! curl -s $DAICARD_ETH_PROVIDER_HOST > /dev/null
do sleep 2
done

echo "waiting for $DAICARD_INDRA_HOST..."
wait-for -t 60 $DAICARD_INDRA_HOST 2> /dev/null
while ! curl -s $DAICARD_INDRA_URL > /dev/null
do sleep 2
done

echo "waiting for $DAICARD_WEB_SERVER_HOST..."
wait-for -t 60 $DAICARD_WEB_SERVER_HOST 2> /dev/null
while ! curl -s $DAICARD_WEB_SERVER_URL > /dev/null
do sleep 2
done

# Kill the loading message server
kill "$loading_pid" && pkill nc

if [[ -z "$DAICARD_DOMAINNAME" ]]
then
  cp /etc/ssl/cert.pem ca-certs.pem
  echo "Entrypoint finished, executing haproxy..."; echo
  exec haproxy -db -f http.cfg
fi

########################################
# Setup SSL Certs

letsencrypt=/etc/letsencrypt/live
certsdir=$letsencrypt/$DAICARD_DOMAINNAME
mkdir -p $certsdir
mkdir -p /etc/haproxy/certs
mkdir -p /var/www/letsencrypt

if [[ "$DAICARD_DOMAINNAME" == "localhost" && ! -f "$certsdir/privkey.pem" ]]
then
  echo "Developing locally, generating self-signed certs"
  openssl req -x509 -newkey rsa:4096 -keyout $certsdir/privkey.pem -out $certsdir/fullchain.pem -days 365 -nodes -subj '/CN=localhost'
fi

if [[ ! -f "$certsdir/privkey.pem" ]]
then
  echo "Couldn't find certs for $DAICARD_DOMAINNAME, using certbot to initialize those now.."
  certbot certonly --standalone -m $DAICARD_EMAIL --agree-tos --no-eff-email -d $DAICARD_DOMAINNAME -n
  [[ $? -eq 0 ]] || sleep 9999 # FREEZE! Don't pester eff & get throttled
fi

echo "Using certs for $DAICARD_DOMAINNAME"
cat $certsdir/fullchain.pem $certsdir/privkey.pem > /root/$DAICARD_DOMAINNAME.pem

export DAICARD_CERTBOT_PORT=31820

function copycerts {
  if [[ -f $certsdir/fullchain.pem && -f $certsdir/privkey.pem ]]
  then cat $certsdir/fullchain.pem $certsdir/privkey.pem > "$DAICARD_DOMAINNAME.pem"
  elif [[ -f "$certsdir-0001/fullchain.pem" && -f "$certsdir-0001/privkey.pem" ]]
  then cat "$certsdir-0001/fullchain.pem" "$certsdir-0001/privkey.pem" > "$DAICARD_DOMAINNAME.pem"
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
      echo -n "Found certs to renew for $DAICARD_DOMAINNAME... "
      certbot renew -n --standalone --http-01-port=$DAICARD_CERTBOT_PORT
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
