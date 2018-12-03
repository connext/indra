FROM postgres:9-alpine

WORKDIR /root
RUN chown -R postgres:postgres /root

RUN apk add --update --no-cache nodejs

COPY node_modules node_modules
COPY migrations migrations
COPY ops ops
COPY build build
COPY test test

USER postgres
ENTRYPOINT ["bash", "ops/entry.sh"]
