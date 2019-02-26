FROM indra_builder

COPY modules/hub/package.json package.json
COPY modules/hub/package-lock.json package-lock.json
RUN npm install --unsafe-perm > /dev/null

COPY modules/client /client

COPY modules/hub/ops ops
COPY modules/hub/dist dist

ENTRYPOINT ["bash", "ops/prod.entry.sh"]
