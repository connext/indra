import { Client } from "pg";

const client = new Client({
  database: "indra",
  host: "localhost",
  password: "indra",
  port: 5432,
  user: "indra",
});

client.connect();

export const clearDb = async (): Promise<void> => {
  console.log(`Clearing database`);
  await client.query("truncate table channel cascade;");
  await client.query("truncate table channel_payment_profiles_payment_profile cascade;");
  await client.query("truncate table linked_transfer cascade;");
  await client.query("truncate table node_records cascade;");
  await client.query("truncate table onchain_transaction cascade;");
  await client.query("truncate table payment_profile cascade;");
  await client.query("truncate table peer_to_peer_transfer cascade;");
  console.log(`Cleared database`);
};
