FROM builder:dev

COPY build build
COPY contracts contracts
COPY migrations migrations
COPY ops ops

ENTRYPOINT ["bash", "ops/entry.sh"]
