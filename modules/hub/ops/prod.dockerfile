FROM node:10-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python

COPY node_modules node_modules
COPY ops ops
COPY dist dist

ENTRYPOINT ["bash", "ops/prod.entry.sh"]
