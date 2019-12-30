FROM node:12.13.0-alpine3.9
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.12.0

COPY ops/ethprovider/package.json package.json
RUN npm install

COPY ops/wait-for.sh wait-for.sh
RUN true
COPY ops/ethprovider/entry.sh entry.sh
RUN true
COPY ops/ethprovider/migrate-contracts.js migrate-contracts.js
RUN true
COPY address-book.json address-book.json
RUN true
COPY modules/cf-adjudicator-contracts cf-adjudicator-contracts
RUN true
COPY modules/cf-funding-protocol-contracts cf-funding-protocol-contracts
RUN true
COPY modules/cf-apps cf-apps
RUN true
COPY modules/contracts contracts

ENV PATH="./node_modules/.bin:${PATH}"
ENTRYPOINT ["bash", "entry.sh"]
