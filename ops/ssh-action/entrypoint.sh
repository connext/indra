#!/bin/bash
set -e -o pipefail

HOST="$1"
SSH_KEY="$2"
CMD="$3"

SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/id_rsa"
KEY_FOOTER='-----END RSA PRIVATE KEY-----'
KEY_HEADER='-----BEGIN RSA PRIVATE KEY-----'

echo "ssh-action activated!"
echo "Executing command \"$CMD\" on host $HOST"

mkdir -p $SSH_DIR
rm -f $KEY_FILE $SSH_DIR/known_hosts
touch $KEY_FILE $SSH_DIR/known_hosts

# Env vars strip out newlines so a naively loaded ssh key will be improperly formatted
# Replace any existing header/footers with manually added ones that include proper newlines
echo $KEY_HEADER >> $KEY_FILE
echo $SSH_KEY | sed "s/$KEY_HEADER//" | sed "s/$KEY_FOOTER//" | tr -d '\n ' >> $KEY_FILE
echo >> $KEY_FILE
echo $KEY_FOOTER >> $KEY_FILE
chmod 400 $KEY_FILE
echo "Loaded ssh key with fingerprint:"
ssh-keygen -lf $KEY_FILE

exec ssh -i $KEY_FILE -o StrictHostKeyChecking=no $HOST "bash -s" <<EOF
  set -e
  $CMD
  exit
EOF
