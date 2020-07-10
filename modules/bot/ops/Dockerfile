FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.14.5
RUN curl https://raw.githubusercontent.com/vishnubob/wait-for-it/ed77b63706ea721766a62ff22d3a251d8b4a6a30/wait-for-it.sh > /bin/wait-for && chmod +x /bin/wait-for

COPY modules/bot/package.json package.json
RUN npm install --only=production > /dev/null 2>&1
# In staging mode we bundle source from @connext packages into the node bundle
# This means the node bundle needs access to the deps for @connext packages too
RUN cp -r node_modules/@connext/*/node_modules/* node_modules || true
COPY modules/bot/ops ops
COPY modules/bot/dist dist
# used to fund agents
COPY modules/contracts/dist contracts/dist
ENV PATH="./node_modules/.bin:${PATH}"
EXPOSE 3333
ENTRYPOINT ["bash", "ops/entry.sh"]
