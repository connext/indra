FROM node:10-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python

COPY package.json package.json
RUN npm install --unsafe-perm > /dev/null

COPY server src

ENTRYPOINT ["node", "src/server.js"]
