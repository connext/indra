FROM node:12.13.0-alpine3.9
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash git

COPY modules/node/package.json package.json
RUN npm install > /dev/null 2>&1

COPY modules/node/ops ops
COPY ops/wait-for.sh ops/wait-for.sh
COPY modules/node/dist dist

ENTRYPOINT ["bash", "ops/entry.sh"]
