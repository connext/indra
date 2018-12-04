FROM connext_hub:dev

# Install common test tools
RUN yarn global add mocha

COPY modules/hub/package.json package.json
COPY ops/test-entry.sh entry.sh
COPY modules/hub/dist dist

ENTRYPOINT ["bash", "entry.sh"]
