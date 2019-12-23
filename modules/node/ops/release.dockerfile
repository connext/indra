FROM node:12.13.0-alpine3.9
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.12.0

COPY modules/node/package.json package.json
RUN npm install > /dev/null 2>&1

# https://github.com/moby/moby/issues/37965#issuecomment-426853382
COPY ops/wait-for.sh ops/wait-for.sh
RUN true
COPY modules/node/ops ops
RUN true
COPY modules/node/dist dist

ENTRYPOINT ["bash", "ops/entry.sh"]
