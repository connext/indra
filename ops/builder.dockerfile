FROM node:10-alpine
WORKDIR /root
ENV HOME /root

# root mode: install global stuff eg build tools
RUN apk add --update --no-cache bash curl g++ gcc git jq make python

COPY ops /ops

ENTRYPOINT ["bash", "/ops/permissions-fixer.sh"]
