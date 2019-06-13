FROM node:10-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash

COPY package.json package.json
RUN npm install

COPY ops ops
COPY dist dist

ENTRYPOINT ["bash", "ops/entry.sh"]
