FROM connext_builder:dev

COPY modules/client /client

COPY modules/hub/node_modules node_modules
COPY modules/hub/ops ops
COPY modules/hub/dist dist

ENTRYPOINT ["bash", "ops/prod.entry.sh"]
