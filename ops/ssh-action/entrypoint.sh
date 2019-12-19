#!/bin/bash
set -e -o pipefail

echo "ssh-action activated"

HOST="$1"
SSH_KEY="$2"
CMD="$3"

echo "executing command \"$CMD\" on host $HOST (home: $HOME)"

SSH_DIR="$HOME/.ssh"
KEY_FILE="$SSH_DIR/id_rsa"

mkdir -p $SSH_DIR
rm -f $KEY_FILE $SSH_DIR/known_hosts
touch $KEY_FILE $SSH_DIR/known_hosts
echo "Creating ssh key"
echo '-----BEGIN RSA PRIVATE KEY-----' >> $KEY_FILE
echo $SSH_KEY >> $KEY_FILE
echo '-----END RSA PRIVATE KEY-----' >> $KEY_FILE
chmod 400 $KEY_FILE
echo "created ssh key"
ssh-keygen -lf $KEY_FILE
echo "key scanning"
ssh-keyscan -t rsa ${HOST#*@} >> $SSH_DIR/known_hosts
echo "doing test connection"
ssh -i $KEY_FILE -o StrictHostKeyChecking=no $HOST hostname

echo "executing cmd for real"
exec ssh -i $KEY_FILE $HOST "bash -s" <<EOF
  set -e
  $CMD
  exit
EOF
