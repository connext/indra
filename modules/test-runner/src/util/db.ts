import { Client as DBClient } from "pg";
import SQL from "sql-template-strings";

import { env } from "./env";

let dbConnected = false;
const dbClient = new DBClient(env.dbConfig);

export const connectDb = async () => {
  dbClient.connect();
  dbConnected = true;
};

export const disconnectDb = async () => {
  dbClient.end();
  dbConnected = false;
};

export const getDbClient = () => {
  if (!dbConnected) {
    throw new Error(`DB is not connected, use connectDb first`);
  }

  return dbClient;
};

export const clearDb = async (): Promise<void> => {
  console.log("Clearing database");
  await dbClient.query("truncate table channel cascade;");
  await dbClient.query("truncate table channel_payment_profiles_payment_profile cascade;");
  await dbClient.query("truncate table linked_transfer cascade;");
  await dbClient.query("truncate table node_records cascade;");
  await dbClient.query("truncate table onchain_transaction cascade;");
  await dbClient.query("truncate table payment_profile cascade;");
  await dbClient.query("truncate table peer_to_peer_transfer cascade;");
  console.log("Cleared database");
};

export const getOnchainTransactionsForChannel = async (userPublicIdentifier: string): Promise<any[]> => {
  const { rows: onchainTransactions } = await dbClient.query(SQL`
      SELECT * FROM onchain_transaction 
      WHERE "channelId" = (
        SELECT id FROM channel
        WHERE "userPublicIdentifier" = ${userPublicIdentifier}
      )
    `);
  return onchainTransactions;
};
