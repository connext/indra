FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.12.0

COPY modules/test-runner/package.json package.json
RUN npm install --only=production > /dev/null 2>&1

# https://github.com/moby/moby/issues/37965#issuecomment-426853382
COPY modules/test-runner/ops ops
RUN true
COPY modules/test-runner/jest.cd.js jest.config.js
RUN true
COPY modules/test-runner/dist dist

ENV PATH="./node_modules/.bin:${PATH}"
ENTRYPOINT ["bash", "ops/entry.sh"]
