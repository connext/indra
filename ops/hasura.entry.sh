export HASURA_GRAPHQL_DATABASE_URL: "postgres://$pg_user:\`cat $pg_pass_file\`@$pg_host:$pg_port/$project"
exec graphql-engine serve