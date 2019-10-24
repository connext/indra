#!/bin/sh
set -e

# export HASURA_GRAPHQL_DATABASE_URL="postgres://$PG_USER:`cat $PG_PASSWORD_FILE`@$PG_HOST:$PG_PORT/$PG_DB"
export HASURA_GRAPHQL_DATABASE_URL="postgres://$READONLY_USER:`cat $READONLY_PASSWORD_FILE`@$PG_HOST:$PG_PORT/$PG_DB"

env
echo;echo "Using DB URL: $HASURA_GRAPHQL_DATABASE_URL";echo;
exec graphql-engine serve
