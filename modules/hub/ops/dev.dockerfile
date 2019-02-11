FROM connext_builder:dev
COPY ops ops
ENTRYPOINT ["bash", "ops/dev.entry.sh"]
