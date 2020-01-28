import { Client as DBClient } from "pg";

import { env } from "./env";

const dbClient = new DBClient(env.dbConfig);

dbClient.connect();

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
