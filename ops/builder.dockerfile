FROM node:10-alpine
WORKDIR /root

# Install common build tools
RUN apk add --update --no-cache bash curl g++ gcc git jq make python

ENTRYPOINT ["bash", "-c"]
