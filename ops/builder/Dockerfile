ARG SOLC_VERSION
FROM ethereum/solc:$SOLC_VERSION-alpine as solc
FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.14.0
RUN npm install -g lerna@3.20.2
COPY --from=solc /usr/local/bin/solc /usr/local/bin/solc
RUN curl https://raw.githubusercontent.com/vishnubob/wait-for-it/ed77b63706ea721766a62ff22d3a251d8b4a6a30/wait-for-it.sh > /wait-for.sh
COPY entry.sh /entry.sh
ENV PATH="./node_modules/.bin:${PATH}"
ENTRYPOINT ["bash", "/entry.sh"]
