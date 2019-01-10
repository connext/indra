FROM node:10-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
ENTRYPOINT ["bash", "ops/entry.sh"]
