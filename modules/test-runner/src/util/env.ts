import { config } from "dotenv";
config();

export const env = {
  contractAddresses: JSON.parse(process.env.INDRA_CONTRACT_ADDRESSES || "{}"),
  chainProviders: JSON.parse(process.env.INDRA_CHAIN_PROVIDERS || "{}"),
  defaultChain: parseInt(process.env.INDRA_DEFAULT_CHAIN || "1337", 10),
  logLevel: parseInt(process.env.INDRA_CLIENT_LOG_LEVEL || "3", 10),
  mnemonic: process.env.INDRA_MNEMONIC || "",
  nodeUrl: process.env.INDRA_NODE_URL || "http://node:8080",
  natsUrl: process.env.INDRA_NATS_URL || "nats://nats:4222",
  proxyUrl: process.env.INDRA_PROXY_URL || "http://proxy:80",
  storeDir: process.env.STORE_DIR || "",
  adminToken: process.env.INDRA_ADMIN_TOKEN || "cxt1234",
  natsPrivateKey: process.env.INDRA_NATS_JWT_SIGNER_PRIVATE_KEY,
  natsPublicKey: process.env.INDRA_NATS_JWT_SIGNER_PUBLIC_KEY,
};
