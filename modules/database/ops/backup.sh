#!/bin/bash
set -e

project="indra"
bucket_name=backups.hub.connext.network
lifecycle=ops/backup-lifecycle.json
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
echo "Done backing up database, snapshot saved to: $backup_path"

if [[ -n "$AWS_ACCESS_KEY_ID" || -n "$AWS_SECRET_ACCESS_KEY" ]]
then

  # Create bucket if it doesn't exist
  if [[ -z "`aws s3api list-buckets | grep '"Name":' | grep "$bucket_name"`" ]]
  then
    echo "Creating bucket $bucket_name"
    aws s3api create-bucket --bucket $bucket_name
    if [[ ! -f "$lifecycle" ]]
    then
      echo "Setting bucke's lifecycle config..."
      aws s3api put-bucket-lifecycle-configuration \
        --bucket $bucket_name \
        --lifecycle-configuration file://$lifecycle
    else echo "Couldn't find lifecycle config file, skipping setup: $lifecycle"
    fi
  else
    echo "AWS S3 bucket $bucket_name already exists"
  fi

  echo "Uploading db snapshot to $bucket_name"
  aws s3 cp $backup_path s3://$bucket_name/backups/$backup_file --sse AES256
  echo "Done, snapshot has been stored remotely"

else
  echo "No access keys found, couldn't backup to remote storage"
fi
