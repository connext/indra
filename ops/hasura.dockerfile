FROM hasura/graphql-engine:v1.0.0-beta.4 as base
COPY hasura.entry.sh entry.sh
ENTRYPOINT ["sh", "entry.sh"]