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

# Manually substitute env var values into CMD
subbed_cmd=$CMD
for var in `env`;
do
  if [[ "$var" == *"|"* ]]
  then echo "Warning, env var ${var%=*} contains a | character, skipping" && continue
  fi
  subbed_cmd="`echo $subbed_cmd | sed 's|$'"${var%=*}"'|'"${var#*=}"'|g'`"
done

echo "Loaded ssh key with fingerprint:"
ssh-keygen -lf $KEY_FILE

echo "Running subbed command: $subbed_cmd"

exec ssh -i $KEY_FILE -o StrictHostKeyChecking=no $HOST "bash -s" <<EOF
  set -e;
  # Run CMD in an up-to-date indra repo
  git clone https://github.com/ConnextProject/indra.git || true;
  cd indra;
  git fetch --all --prune --tags;
  $subbed_cmd
  exit;
EOF
