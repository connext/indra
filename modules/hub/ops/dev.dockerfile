FROM node:10-alpine
WORKDIR /root
ENV HOME /root

RUN apk add --update --no-cache bash
RUN yarn global add nodemon typescript

COPY ops ops

ENTRYPOINT ["bash", "ops/dev.entry.sh"]
