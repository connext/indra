import { config } from "dotenv";
config();

export const env = {
  dbConfig: {
    database: process.env.INDRA_PG_DATABASE || "",
    host: process.env.INDRA_PG_HOST || "",
    password: process.env.INDRA_PG_PASSWORD || "",
    port: parseInt(process.env.INDRA_PG_PORT || "", 10),
    user: process.env.INDRA_PG_USERNAME || "",
  },
  ethProviderUrl: process.env.INDRA_ETH_RPC_URL || "",
  logLevel: parseInt(process.env.INDRA_CLIENT_LOG_LEVEL || "3", 10),
  mnemonic: process.env.INDRA_ETH_MNEMONIC || "",
  nodeUrl: process.env.INDRA_NODE_URL || "",
  storeDir: process.env.STORE_DIR || "",
<<<<<<< HEAD
  adminToken: process.env.INDRA_ADMIN_TOKEN || "foo",
=======
  natsPrivateKey: process.env.INDRA_NATS_JWT_SIGNER_PRIVATE_KEY,
  natsPublicKey: process.env.INDRA_NATS_JWT_SIGNER_PUBLIC_KEY,
>>>>>>> WIP test suite
};
// console.log(`Starting tests in env: ${JSON.stringify(env, null, 2)}`);
