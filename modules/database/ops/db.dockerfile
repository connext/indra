FROM postgres:9-alpine
WORKDIR /root
# need node for db-migrate
RUN apk add --update --no-cache nodejs
RUN chown -R postgres:postgres /root
COPY . .
ENTRYPOINT ["bash", "ops/entry.sh"]
