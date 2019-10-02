export HASURA_GRAPHQL_DATABASE_URL="postgres://$PG_USER:`cat $PG_PASSWORD_FILE`@$PG_HOST:$PG_PORT/$PG_DATABASE"
exec graphql-engine serve
