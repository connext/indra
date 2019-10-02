FROM hasura/graphql-engine:v1.0.0-beta.6
COPY ops/hasura.entry.sh entry.sh
ENTRYPOINT ["sh", "entry.sh"]
