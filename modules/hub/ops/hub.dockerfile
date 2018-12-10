FROM node:10-alpine

RUN apk add --update --no-cache bash

COPY node_modules node_modules
COPY ops ops
COPY dist dist

ENTRYPOINT ["bash", "ops/hub.entry.sh"]
