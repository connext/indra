FROM node:10-alpine
WORKDIR /root
ENV HOME /root

COPY node_modules node_modules
COPY src src

ENTRYPOINT ["node", "src/server.js"]
