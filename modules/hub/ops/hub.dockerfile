FROM builder:dev

COPY node_modules node_modules
COPY ops ops
COPY dist dist

ENTRYPOINT ["bash", "ops/entry.sh"]
