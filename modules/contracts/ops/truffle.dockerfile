FROM connext_builder:dev

COPY node_modules node_modules
COPY build build
COPY contracts contracts
COPY migrations migrations
COPY ops ops
COPY truffle.js truffle.js

ENTRYPOINT ["bash", "ops/entry.sh"]
