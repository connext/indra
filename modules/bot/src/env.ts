export const env = {
  ethProviderUrl: process.env.INDRA_CHAIN_URL!,
  nodeUrl: process.env.INDRA_NODE_URL!,
};

if (!env.ethProviderUrl) {
  throw new Error(`An INDRA_CHAIN_URL is required but was not provided.`);
}

if (!env.nodeUrl) {
  throw new Error(`An INDRA_NODE_URL is required but was not provided.`);
}
