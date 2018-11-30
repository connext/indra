FROM postgres:9-alpine

RUN apk add --update --no-cache nodejs yarn 

RUN yarn global add db-migrate

COPY migrations migrations
COPY ops ops

ENTRYPOINT ["bash", "ops/entry.sh"]

