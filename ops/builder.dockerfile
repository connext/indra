FROM node:10-alpine

RUN mkdir -p /app
WORKDIR /app

# Install native build tools
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN yarn global add ganache-cli truffle

ENTRYPOINT ["bash", "-c"]
