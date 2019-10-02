export HASURA_GRAPHQL_DATABASE_URL="postgres://$pg_user:`cat $pg_password_file`@$pg_host:$pg_port/$pg_database"
exec graphql-engine serve
