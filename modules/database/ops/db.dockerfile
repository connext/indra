FROM postgres:9-alpine
WORKDIR /root
RUN chown -R postgres:postgres /root
# need node for db-migrate & aws-cli for sending backups to s3
RUN apk add --update --no-cache coreutils groff less mailcap nodejs py-pip && \
    pip install --upgrade awscli
COPY . .
ENTRYPOINT ["bash", "ops/entry.sh"]
