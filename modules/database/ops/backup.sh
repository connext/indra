#!/bin/bash
set -e

project="indra"
bucket_name=backups.hub.connext.network
if [[ -n "$ETH_NETWORK" ]]
then network=$ETH_NETWORK
else network=ganache
fi

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
timestamp="`date +"%y%m%d-%H%M%S"`"
backup_file=$network-$timestamp.sql
backup_path=$dir/snapshots/$backup_file
mkdir -p "`dirname $backup_path`"

echo "Creating database snapshot..."

pg_dump --username=$project $project > $backup_path

if [[ -n "$AWS_ACCESS_KEY_ID" || -n "$AWS_SECRET_ACCESS_KEY" ]]
then
  echo "Uploading db snapshot to remote storage..."
  S3_KEY=$bucket_name/backups/$backup_file
  aws s3 cp $backup_path s3://$S3_KEY --sse AES256
else
  echo "No access keys found, couldn't backup to remote storage"
fi

echo "Done backing up db, snapshot saved to $backup_path"
