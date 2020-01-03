FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.12.0

COPY modules/integration-test/package.json package.json
RUN npm install > /dev/null 2>&1

# https://github.com/moby/moby/issues/37965#issuecomment-426853382
COPY ops/wait-for.sh wait-for.sh
RUN true
COPY modules/integration-test/jest.config.js jest.config.js
RUN true
COPY modules/integration-test/jest.setup.js jest.setup.js
RUN true
COPY tsconfig.json /tsconfig.json
RUN true
COPY modules/integration-test/tsconfig.json tsconfig.json
RUN true
COPY modules/integration-test/src src

ENV PATH="./node_modules/.bin:${PATH}"
ENTRYPOINT ["jest"]

