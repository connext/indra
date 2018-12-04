FROM node:10-alpine
WORKDIR /root

# root mode: install global stuff eg build tools
RUN apk add --update --no-cache bash curl g++ gcc git jq make python

COPY ops /ops

# use a different user for subsequent local build steps
RUN addgroup -S docker && adduser -D -S -s /bin/sh -h /root -G docker docker && chown -R docker:docker /root
USER docker

ENTRYPOINT ["bash", "/ops/permissions-fixer.sh"]
