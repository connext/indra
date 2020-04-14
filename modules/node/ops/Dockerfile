FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.12.0
COPY modules/node/package.json package.json
RUN npm install --only=production > /dev/null 2>&1
RUN curl https://raw.githubusercontent.com/vishnubob/wait-for-it/ed77b63706ea721766a62ff22d3a251d8b4a6a30/wait-for-it.sh > /wait-for.sh
COPY modules/node .
ENTRYPOINT ["bash", "ops/entry.sh"]
