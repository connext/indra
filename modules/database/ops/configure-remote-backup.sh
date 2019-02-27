#!/usr/bin/env bash

bucket_name=backups.hub.connext.network
lifecycle=ops/backup-lifecycle.json
logging=ops/backup-logging.json

if [[ -z "`which aws`" ]]
then echo "You need the aws cli installed to do this. If you're on Mac, try: brew install awscli" && exit
elif [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" ]]
then echo "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars are needed to setup remote storage" && exit
fi

# Create bucket if it doesn't exist
if [[ -z "`aws s3api list-buckets | grep '"Name":' | grep "$bucket_name"`" ]]
then
  if [[ ! -f "$lifecycle" ]]
  then echo "Error, couldn't find lifecycle config file: $lifecycle" && exit
  fi

  echo "Creating bucket $bucket_name"
  aws s3api create-bucket --bucket $bucket_name

  if [[ "$?" != "0" ]]
  then echo "Something went wrong creating the bucket, aborting" && exit
  fi

  echo "Updating lifecycle config..."
  aws s3api put-bucket-lifecycle-configuration \
    --bucket $bucket_name \
    --lifecycle-configuration file://$lifecycle

else
  echo "AWS S3 bucket $bucket_name already exists"
fi

echo "Done!"

# TODO: require MFA to delete backups?
# aws s3api put-bucket-versioning \
#   --mfa <otp> \
#   --bucket <bucketname> \
#   --versioning-configuration Status=Enabled,MFADelete=Enabled
