FROM builder:dev

COPY build build
COPY contracts contracts
COPY migrations migrations
COPY ops ops
COPY truffle.js truffle.js

ENTRYPOINT ["bash", "ops/entry.sh"]
