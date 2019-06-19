import "dotenv";

const ethNetwork = process.env.ETHEREUM_NETWORK || "kovan";

export const config = {
  baseUrl: process.env.BASE_URL!,
  ethNetwork,
  ethRpcUrl: process.env.ETHEREUM_NETWORK || `https://${ethNetwork}.infura.io/metamask`,
  nodeUrl: process.env.NODE_URL,
  privateKey: process.env.PRIVATE_KEY,
};
