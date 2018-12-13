FROM connext_hub:dev

RUN yarn global add mocha

ENTRYPOINT ["bash", "ops/test.entry.sh"]
