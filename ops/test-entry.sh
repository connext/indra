#!/bin/bash
set -e

DATABASE=database:5432
export DATABASE_URL_TEST="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$DATABASE/$POSTGRES_DB"
export REDIS_URL_TEST="redis://redis:6379/6"

env

yarn test
