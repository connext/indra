#!/bin/bash
set -e -o pipefail

HOST="$1"
SSH_KEY="$2"
CMD="$3"

SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/id_rsa"

mkdir -p $SSH_DIR
rm -f $KEY_FILE $SSH_DIR/known_hosts
touch $KEY_FILE $SSH_DIR/known_hosts
echo '-----BEGIN RSA PRIVATE KEY-----' >> $KEY_FILE
echo $SSH_KEY >> $KEY_FILE
echo '-----END RSA PRIVATE KEY-----' >> $KEY_FILE
chmod 400 $KEY_FILE
ssh-keygen -lf $KEY_FILE
ssh-keyscan -t rsa $STAGING_DOMAINNAME >> $SSH_DIR/known_hosts
ssh -i $KEY_FILE -o StrictHostKeyChecking=no ubuntu@$STAGING_DOMAINNAME hostname

exec ssh -i $KEY_FILE $HOST "bash -s" <<EOF
  set -e
  $CMD
  exit
EOF
