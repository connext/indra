export HASURA_GRAPHQL_DATABASE_URL="postgres://$HASURA_USER:`cat $HASURA_PASSWORD_FILE`@$PG_HOST:$PG_PORT/$PG_DATABASE"
env
echo;echo "Using DB URL: $HASURA_GRAPHQL_DATABASE_URL";echo;
exec graphql-engine serve
