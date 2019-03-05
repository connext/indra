FROM node:10-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python

COPY modules/hub/package.json package.json
RUN npm install --unsafe-perm > /dev/null

COPY modules/client /client

COPY modules/hub/ops ops
COPY modules/hub/dist dist

ENTRYPOINT ["bash", "ops/prod.entry.sh"]
