import { Pool } from "pg";
import SQL from "sql-template-strings";

import { env } from "./env";

const dbPool = new Pool(env.dbConfig);

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
dbPool.on("error", (err, client) => {
  console.error("Unexpected error on idle pg client", err);
  process.exit(1);
});

export const clearDb = async (): Promise<void> => {
  await dbPool.query("truncate table channel cascade;");
  await dbPool.query("truncate table channel_payment_profiles_payment_profile cascade;");
  await dbPool.query("truncate table linked_transfer cascade;");
  await dbPool.query("truncate table node_records cascade;");
  await dbPool.query("truncate table onchain_transaction cascade;");
  await dbPool.query("truncate table payment_profile cascade;");
  await dbPool.query("truncate table peer_to_peer_transfer cascade;");
};

export const getOnchainTransactionsForChannel = async (
  userIdentifier: string,
): Promise<any[]> => {
  const { rows: onchainTransactions } = await dbPool.query(SQL`
      SELECT * FROM onchain_transaction 
      WHERE "channelMultisigAddress" = (
        SELECT "multisigAddress" FROM channel
        WHERE "userIdentifier" = ${userIdentifier}
      )
    `);
  return onchainTransactions;
};
