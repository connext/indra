FROM builder:dev

# Install common test tools
RUN yarn global add mocha
RUN yarn global add ts-node

COPY modules/hub/package.json package.json
COPY ops/test-entry.sh entry.sh
COPY modules/hub/src src

ENTRYPOINT ["bash", "entry.sh"]
