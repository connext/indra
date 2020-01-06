import { Client as DBClient } from "pg";

const dbClient = new DBClient({
  database: process.env.INDRA_PG_DATABASE,
  host: process.env.INDRA_PG_HOST,
  password: process.env.INDRA_PG_PASSWORD,
  port: parseInt(process.env.INDRA_PG_PORT!, 10),
  user: process.env.INDRA_PG_USERNAME,
});

dbClient.connect();

export const clearDb = async (): Promise<void> => {
  console.log(`Clearing database`);
  await dbClient.query("truncate table channel cascade;");
  await dbClient.query("truncate table channel_payment_profiles_payment_profile cascade;");
  await dbClient.query("truncate table linked_transfer cascade;");
  await dbClient.query("truncate table node_records cascade;");
  await dbClient.query("truncate table onchain_transaction cascade;");
  await dbClient.query("truncate table payment_profile cascade;");
  await dbClient.query("truncate table peer_to_peer_transfer cascade;");
  console.log(`Cleared database`);
};
