ARG SOLC_VERSION
FROM ethereum/solc:$SOLC_VERSION-alpine as solc
FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.12.0
RUN npm install -g lerna@3.20.2
COPY --from=solc /usr/local/bin/solc /usr/local/bin/solc
RUN true
COPY ops/wait-for.sh /wait-for.sh
RUN true
COPY ops /ops
ENV PATH="./node_modules/.bin:${PATH}"
ENTRYPOINT ["bash", "/ops/permissions-fixer.sh"]
