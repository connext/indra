#!/bin/bash
set -e

DATABASE=database:5432
export DATABASE_URL_TEST="postgresql://$POSTGRES_USER:`cat $POSTGRES_PASSWORD_FILE`@$DATABASE/$POSTGRES_DB"

env

yarn test
