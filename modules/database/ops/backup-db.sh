#!/bin/bash
set -e

network=rinkeby
bucket_name=backups.hub.connext.network

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
timestamp="`date +"%y%m%d-%H%M%S"`"
backup_file=$dir/ops/snapshots/$network-$timestamp.sql
mkdir -p ops/snapshots

project="`cat package.json | grep '"name":' | awk -F '"' '{print $4}' | tr -d '-'`"
service=${project}_database
service_id="`docker service ps -q $service | head -n 1`"
id="`docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' $service_id`"

if [[ -z "`docker service ps -q $service`" ]]
then echo "Error: expected to see $service running" && exit 1
fi

echo "Creating database snapshot..."

docker exec $id bash -c "pg_dump --username=$project $project" > $backup_file

if [[ -n "$AWS_ACCESS_KEY_ID" || -n "$AWS_SECRET_ACCESS_KEY" ]]
then
  echo "Uploading db snapshot to remote storage..."
  S3_KEY=$bucket_name/backups/$network-$timestamp.sql
  aws s3 cp $backup_file s3://$S3_KEY --sse AES256
else
  echo "No access keys found, couldn't backup to remote storage"
fi

echo "Done"
