FROM connext_builder:dev
COPY ops ops
ENTRYPOINT ["bash", "ops/entry.dev.sh"]
