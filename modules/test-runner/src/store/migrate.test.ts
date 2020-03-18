import { Client } from "pg";
import { before } from "mocha";

import { expect, getDbClient } from "../util";
import SQL from "sql-template-strings";


describe("Store Migrations", () => {
  let dbClient: Client;

  before(async () => {
    dbClient = getDbClient();
  });

  it("node can migrate from v0 to v1", async () => {
    await dbClient.query(SQL`
      INSERT INTO node_records
      VALUES ()
    `)
  });
});
