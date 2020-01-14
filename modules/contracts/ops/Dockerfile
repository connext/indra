FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.12.0

RUN npm install -g ganache-cli@6.7.0
COPY modules/contracts/package.json package.json
RUN npm install --only=production > /dev/null 2>&1

COPY ops/wait-for.sh wait-for.sh
RUN true
COPY modules/contracts contracts

ENTRYPOINT ["bash", "contracts/ops/entry.sh"]
